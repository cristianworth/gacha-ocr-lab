param(
  [string]$OutputRoot,
  [ValidateRange(1,16384)][int]$ExpectedWidth = 1440,
  [ValidateRange(1,16384)][int]$ExpectedHeight = 900,
  [string]$ProcessNamesJson = '["GenshinImpact","YuanShen"]',
  [switch]$ValidateOnly
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Console]::InputEncoding = New-Object System.Text.UTF8Encoding($false)
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)

$source = @'
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;

namespace GachaOcrWindows {
  public sealed class ControlError : Exception {
    public string Code { get; private set; }
    public ControlError(string code, string message) : base(message) { Code = code; }
  }
  public sealed class WindowInfo {
    public int pid; public string title; public string handle;
    public int width; public int height; public int left; public int top;
    public bool foreground; public bool minimized; public bool visible;
  }
  public sealed class ControlStatus {
    public bool attached; public bool armed; public bool stopped; public string stopReason;
    public WindowInfo window; public string emergencyKey = "F8";
  }
  public sealed class CaptureInfo { public string path; public int width; public int height; }
  public sealed class GameControl : IDisposable {
    [StructLayout(LayoutKind.Sequential)] private struct RECT { public int Left, Top, Right, Bottom; }
    [StructLayout(LayoutKind.Sequential)] private struct POINT { public int X, Y; }
    [StructLayout(LayoutKind.Sequential)] private struct MOUSEINPUT {
      public int dx, dy; public uint mouseData, dwFlags, time; public UIntPtr dwExtraInfo;
    }
    [StructLayout(LayoutKind.Explicit)] private struct INPUTUNION { [FieldOffset(0)] public MOUSEINPUT mouse; }
    [StructLayout(LayoutKind.Sequential)] private struct INPUT { public uint type; public INPUTUNION data; }
    private delegate bool EnumWindowProc(IntPtr handle, IntPtr parameter);
    [StructLayout(LayoutKind.Sequential)] private struct FILETIME { public uint Low, High; }
    [DllImport("kernel32.dll", SetLastError=true)] private static extern IntPtr OpenProcess(uint access, bool inherit, uint pid);
    [DllImport("kernel32.dll", SetLastError=true)] private static extern bool GetProcessTimes(IntPtr process, out FILETIME created, out FILETIME exited, out FILETIME kernel, out FILETIME user);
    [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)] private static extern bool QueryFullProcessImageName(IntPtr process, uint flags, StringBuilder path, ref uint size);
    [DllImport("kernel32.dll")] private static extern bool CloseHandle(IntPtr handle);
    [DllImport("user32.dll")] private static extern bool EnumWindows(EnumWindowProc callback, IntPtr parameter);
    [DllImport("user32.dll")] private static extern bool IsWindow(IntPtr handle);
    [DllImport("user32.dll")] private static extern bool IsWindowVisible(IntPtr handle);
    [DllImport("user32.dll")] private static extern bool IsIconic(IntPtr handle);
    [DllImport("user32.dll")] private static extern bool GetClientRect(IntPtr handle, out RECT rectangle);
    [DllImport("user32.dll")] private static extern bool GetWindowRect(IntPtr handle, out RECT rectangle);
    [DllImport("user32.dll")] private static extern bool ClientToScreen(IntPtr handle, ref POINT point);
    [DllImport("user32.dll")] private static extern uint GetWindowThreadProcessId(IntPtr handle, out uint pid);
    [DllImport("user32.dll")] private static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] private static extern IntPtr GetAncestor(IntPtr handle, uint flags);
    [DllImport("user32.dll")] private static extern IntPtr WindowFromPoint(POINT point);
    [DllImport("user32.dll", CharSet=CharSet.Unicode)] private static extern int GetWindowText(IntPtr handle, StringBuilder text, int count);
    [DllImport("user32.dll", CharSet=CharSet.Unicode)] private static extern int GetClassName(IntPtr handle, StringBuilder name, int count);
    [DllImport("user32.dll")] private static extern bool ShowWindow(IntPtr handle, int command);
    [DllImport("user32.dll")] private static extern bool SetForegroundWindow(IntPtr handle);
    [DllImport("user32.dll")] private static extern short GetAsyncKeyState(int key);
    [DllImport("user32.dll")] private static extern bool SetProcessDPIAware();
    [DllImport("user32.dll")] private static extern bool SetProcessDpiAwarenessContext(IntPtr context);
    [DllImport("user32.dll")] private static extern int GetSystemMetrics(int index);
    [DllImport("user32.dll", SetLastError=true)] private static extern uint SendInput(uint count, INPUT[] input, int size);
    [DllImport("dwmapi.dll")] private static extern int DwmGetWindowAttribute(IntPtr handle, int attribute, out int value, int size);

    private readonly object gate = new object();
    private readonly HashSet<string> allowed;
    private readonly int expectedWidth, expectedHeight;
    private readonly string outputRoot;
    private readonly ManualResetEvent shutdown = new ManualResetEvent(false);
    private Thread monitor;
    private IntPtr attachedHandle = IntPtr.Zero;
    private int attachedPid;
    private long processStarted;
    private WindowInfo baseline;
    private bool armed, stopped, closed;
    private string stopReason;
    private long lastInput;

    public GameControl(string root, int width, int height, string[] processNames) {
      if (String.IsNullOrWhiteSpace(root)) throw new ControlError("invalid-path", "OutputRoot e obrigatorio.");
      if (width < 1 || height < 1 || width > 16384 || height > 16384) throw new ControlError("invalid-size", "Dimensoes esperadas invalidas.");
      if (processNames == null || processNames.Length == 0) throw new ControlError("invalid-process", "Allowlist de processos vazia.");
      allowed = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
      foreach (string name in processNames) {
        if (String.IsNullOrWhiteSpace(name) || !System.Text.RegularExpressions.Regex.IsMatch(name, "^[A-Za-z0-9_-]+$")) throw new ControlError("invalid-process", "Nome de processo invalido.");
        allowed.Add(name);
      }
      expectedWidth = width; expectedHeight = height;
      outputRoot = Path.GetFullPath(root).TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar) + Path.DirectorySeparatorChar;
      if (!Directory.Exists(outputRoot)) throw new ControlError("invalid-path", "OutputRoot deve existir.");
      try { SetProcessDpiAwarenessContext(new IntPtr(-4)); }
      catch (EntryPointNotFoundException) { SetProcessDPIAware(); }
    }

    private static IntPtr Root(IntPtr handle) { return GetAncestor(handle, 2); }
    private static string Title(IntPtr handle) {
      StringBuilder text = new StringBuilder(4096); GetWindowText(handle, text, text.Capacity); return text.ToString();
    }
    private WindowInfo ReadWindow(IntPtr handle) {
      uint pid; GetWindowThreadProcessId(handle, out pid);
      RECT area; POINT origin = new POINT();
      if (!IsWindow(handle) || !GetClientRect(handle, out area) || !ClientToScreen(handle, ref origin)) throw new ControlError("window-exited", "A janela nao esta mais disponivel.");
      return new WindowInfo { pid = (int)pid, title = Title(handle), handle = handle.ToInt64().ToString(),
        width = area.Right - area.Left, height = area.Bottom - area.Top, left = origin.X, top = origin.Y,
        foreground = Root(GetForegroundWindow()) == handle, minimized = IsIconic(handle), visible = IsWindowVisible(handle) };
    }
    private long VerifiedProcessStarted(int pid) {
      // Metadata only: .NET Framework HasExited/StartTime request broader access than this helper needs.
      IntPtr process = OpenProcess(0x1000, false, (uint)pid); // PROCESS_QUERY_LIMITED_INFORMATION
      if (process == IntPtr.Zero) throw new ControlError("process-query-denied", "Nao foi possivel consultar metadados do processo (Win32 " + Marshal.GetLastWin32Error() + "). Sem elevacao automatica.");
      try {
        StringBuilder path = new StringBuilder(32768); uint size = (uint)path.Capacity;
        FILETIME created, exited, kernel, user;
        if (!QueryFullProcessImageName(process, 0, path, ref size) || !GetProcessTimes(process, out created, out exited, out kernel, out user))
          throw new ControlError("process-query-denied", "Nao foi possivel verificar a identidade do processo (Win32 " + Marshal.GetLastWin32Error() + ").");
        if (!allowed.Contains(Path.GetFileNameWithoutExtension(path.ToString()))) throw new ControlError("process-not-allowed", "O executavel nao pertence a allowlist.");
        return ((long)created.High << 32) | created.Low;
      } finally { CloseHandle(process); }
    }
    private void EnsureOpen() { if (closed) throw new ControlError("closed", "Helper encerrado."); }
    private WindowInfo VerifyAttached() {
      EnsureOpen();
      if (attachedHandle == IntPtr.Zero) throw new ControlError("not-attached", "Anexe uma janela primeiro.");
      uint pid; GetWindowThreadProcessId(attachedHandle, out pid);
      if (!IsWindow(attachedHandle) || pid != attachedPid || VerifiedProcessStarted(attachedPid) != processStarted) throw new ControlError("window-exited", "O processo/janela anexado mudou ou encerrou.");
      return ReadWindow(attachedHandle);
    }
    private void ValidateSize(WindowInfo window) {
      if (window.width != expectedWidth || window.height != expectedHeight) throw new ControlError("unsupported-size", "Area cliente deve medir " + expectedWidth + "x" + expectedHeight + "; atual: " + window.width + "x" + window.height + ".");
    }
    private void Stop(string reason) { stopped = true; armed = false; if (stopReason == null) stopReason = reason; }
    private WindowInfo CheckArmed() {
      EnsureOpen();
      if (stopped) throw new ControlError("stopped", "Sessao interrompida: " + stopReason + ". Reanexe explicitamente para iniciar outra sessao.");
      if (!armed) throw new ControlError("not-armed", "Arme a sessao explicitamente antes de capturar ou enviar input.");
      WindowInfo window;
      try { window = VerifyAttached(); }
      catch { Stop("window-exited"); throw new ControlError("stopped", "O processo/janela anexado encerrou ou mudou."); }
      if ((GetAsyncKeyState(0x77) & 0x8001) != 0) Stop("emergency-f8");
      else if (window.minimized) Stop("minimized");
      else if (!window.visible) Stop("hidden");
      else if (!window.foreground) Stop("focus-lost");
      else if (window.width != baseline.width || window.height != baseline.height) Stop("resized");
      else if (window.left != baseline.left || window.top != baseline.top) Stop("moved");
      if (stopped) throw new ControlError("stopped", "Sessao interrompida: " + stopReason + ".");
      return window;
    }
    private void CheckUnobscured(WindowInfo window) {
      bool beforeAttached = true, covered = false;
      string blocker = null;
      EnumWindows(delegate(IntPtr handle, IntPtr unused) {
        if (handle == attachedHandle) { beforeAttached = false; return false; }
        if (!IsWindowVisible(handle) || IsIconic(handle)) return true;
        int cloaked;
        try { if (DwmGetWindowAttribute(handle, 14, out cloaked, 4) == 0 && cloaked != 0) return true; }
        catch (DllNotFoundException) { }
        RECT bounds;
        if (GetWindowRect(handle, out bounds) && bounds.Right > window.left && bounds.Left < window.left + window.width
            && bounds.Bottom > window.top && bounds.Top < window.top + window.height) {
          covered = true;
          uint pid; GetWindowThreadProcessId(handle, out pid);
          StringBuilder className = new StringBuilder(256); GetClassName(handle, className, className.Capacity);
          string processName = "desconhecido";
          try { using (Process process = Process.GetProcessById((int)pid)) { processName = process.ProcessName; } } catch { }
          blocker = "aplicativo=" + processName + "; PID=" + pid + "; classe=" + className + "; area=" + bounds.Left + "," + bounds.Top + "," + (bounds.Right - bounds.Left) + "," + (bounds.Bottom - bounds.Top);
          return false;
        }
        return true;
      }, IntPtr.Zero);
      if (covered) {
        Stop("occluded");
        throw new ControlError("stopped", "Janela sobreposta detectada (" + blocker + "). Minimize/remova essa janela da area do jogo, incluindo overlays. O teste por retangulo e conservador; captura/input recusado.");
      }
      if (beforeAttached) { Stop("window-order-unverified"); throw new ControlError("stopped", "A janela do jogo nao foi encontrada na ordem de janelas; captura/input recusado."); }
    }
    public WindowInfo[] List() {
      lock (gate) {
        EnsureOpen(); List<WindowInfo> windows = new List<WindowInfo>();
        // Resolve the allowlist once; ProcessName queries per HWND repeatedly enumerate process metadata.
        HashSet<int> allowedPids = new HashSet<int>();
        foreach (string name in allowed) {
          foreach (Process process in Process.GetProcessesByName(name)) {
            using (process) { try { allowedPids.Add(process.Id); } catch (InvalidOperationException) { } }
          }
        }
        EnumWindows(delegate(IntPtr handle, IntPtr unused) {
          uint pid; GetWindowThreadProcessId(handle, out pid);
          if (Root(handle) != handle || !allowedPids.Contains((int)pid)) return true;
          try { WindowInfo info = ReadWindow(handle); if (!String.IsNullOrWhiteSpace(info.title)) windows.Add(info); } catch { }
          return true;
        }, IntPtr.Zero);
        return windows.ToArray();
      }
    }
    public WindowInfo Attach(int pid) {
      lock (gate) {
        EnsureOpen();
        WindowInfo[] windows = List(); List<WindowInfo> candidates = new List<WindowInfo>();
        // IME/helper windows can share the game's PID but are not usable game surfaces.
        foreach (WindowInfo window in windows) if ((pid == 0 || window.pid == pid) && window.visible && window.width > 0 && window.height > 0) candidates.Add(window);
        if (candidates.Count == 0) throw new ControlError("window-not-found", "Nenhuma janela correspondente a allowlist/PID.");
        if (candidates.Count != 1) throw new ControlError("multiple-windows", "Mais de uma janela candidata; informe o PID da janela desejada.");
        WindowInfo selected = candidates[0]; ValidateSize(selected);
        IntPtr handle = new IntPtr(Int64.Parse(selected.handle));
        long started = VerifiedProcessStarted(selected.pid);
        attachedHandle = handle; attachedPid = selected.pid; processStarted = started;
        armed = false; stopped = false; stopReason = null; baseline = null;
        return VerifyAttached();
      }
    }
    public WindowInfo Activate() {
      lock (gate) {
        WindowInfo window = VerifyAttached(); ValidateSize(window);
        if (armed || stopped) throw new ControlError("invalid-state", "Ative antes de armar; uma sessao interrompida exige novo attach.");
        if (window.minimized) ShowWindow(attachedHandle, 9);
        if (!SetForegroundWindow(attachedHandle)) throw new ControlError("activation-refused", "Windows recusou ativar a janela; o usuario pode ativa-la manualmente.");
        Thread.Sleep(100);
        window = VerifyAttached(); ValidateSize(window);
        if (!window.foreground || window.minimized || !window.visible) throw new ControlError("activation-refused", "Janela anexada nao ficou ativa e visivel.");
        return window;
      }
    }
    public ControlStatus Arm() {
      lock (gate) {
        WindowInfo window = VerifyAttached(); ValidateSize(window);
        if (stopped) throw new ControlError("stopped", "Sessao interrompida exige novo attach explicito.");
        if (armed) throw new ControlError("already-armed", "Sessao ja armada.");
        if (!window.foreground || window.minimized || !window.visible) throw new ControlError("not-foreground", "Janela deve estar ativa e visivel para armar.");
        if ((GetAsyncKeyState(0x77) & 0x8000) != 0) throw new ControlError("emergency-f8", "F8 esta pressionado; armamento recusado.");
        CheckUnobscured(window);
        baseline = window; armed = true;
        if (monitor == null) {
          monitor = new Thread(delegate() {
            while (!shutdown.WaitOne(50)) {
              lock (gate) { if (closed) return; if (armed) { try { CheckArmed(); } catch { } } }
            }
          });
          monitor.IsBackground = true; monitor.Name = "GachaOcrWindowMonitor"; monitor.Start();
        }
        return Status();
      }
    }
    public ControlStatus Status() {
      lock (gate) {
        EnsureOpen(); WindowInfo window = null;
        if (armed) { try { window = CheckArmed(); } catch { } }
        if (window == null && attachedHandle != IntPtr.Zero) { try { window = VerifyAttached(); } catch { } }
        return new ControlStatus { attached = attachedHandle != IntPtr.Zero, armed = armed, stopped = stopped, stopReason = stopReason, window = window };
      }
    }
    private string CapturePath(string requested) {
      if (String.IsNullOrWhiteSpace(requested)) throw new ControlError("invalid-path", "Caminho PNG requerido.");
      string path = Path.GetFullPath(requested);
      if (!path.StartsWith(outputRoot, StringComparison.OrdinalIgnoreCase) || !String.Equals(Path.GetExtension(path), ".png", StringComparison.OrdinalIgnoreCase)) throw new ControlError("invalid-path", "Captura deve ficar dentro de OutputRoot e usar PNG.");
      string directory = Path.GetDirectoryName(path);
      if (!Directory.Exists(directory)) throw new ControlError("invalid-path", "Pasta da captura deve existir.");
      string current = directory;
      while (current != null && current.Length >= outputRoot.TrimEnd(Path.DirectorySeparatorChar).Length) {
        if ((File.GetAttributes(current) & FileAttributes.ReparsePoint) != 0) throw new ControlError("invalid-path", "Links/reparse points nao sao aceitos no destino da captura.");
        if (String.Equals(current.TrimEnd(Path.DirectorySeparatorChar) + Path.DirectorySeparatorChar, outputRoot, StringComparison.OrdinalIgnoreCase)) break;
        current = Path.GetDirectoryName(current);
      }
      if (File.Exists(path) || Directory.Exists(path)) throw new ControlError("file-exists", "Captura existente nao sera sobrescrita.");
      return path;
    }
    public CaptureInfo Capture(string requested) {
      lock (gate) {
        string path = CapturePath(requested);
        WindowInfo window = CheckArmed(); CheckUnobscured(window); CheckArmed();
        using (Bitmap image = new Bitmap(window.width, window.height, PixelFormat.Format24bppRgb)) {
          using (Graphics graphics = Graphics.FromImage(image)) { graphics.CopyFromScreen(window.left, window.top, 0, 0, new Size(window.width, window.height), CopyPixelOperation.SourceCopy); }
          CheckArmed(); CheckUnobscured(window);
          using (FileStream output = new FileStream(path, FileMode.CreateNew, FileAccess.Write, FileShare.None)) { image.Save(output, ImageFormat.Png); }
        }
        return new CaptureInfo { path = path, width = window.width, height = window.height };
      }
    }
    private INPUT Mouse(int x, int y, uint flags, uint data) {
      INPUT input = new INPUT(); input.type = 0;
      input.data.mouse = new MOUSEINPUT { dx = x, dy = y, dwFlags = flags, mouseData = data, time = 0, dwExtraInfo = UIntPtr.Zero };
      return input;
    }
    private void Input(int x, int y, int delta, bool click) {
      if (x < 0 || y < 0 || x >= expectedWidth || y >= expectedHeight) throw new ControlError("invalid-coordinate", "Coordenadas devem estar dentro da area cliente.");
      if (!click && (delta == 0 || Math.Abs((long)delta) > 10)) throw new ControlError("invalid-scroll", "delta deve ser um numero inteiro de notches entre -10 e 10, diferente de zero.");
      double elapsed = (Stopwatch.GetTimestamp() - lastInput) * 1000.0 / Stopwatch.Frequency;
      if (lastInput != 0 && elapsed < 100) Thread.Sleep((int)Math.Ceiling(100 - elapsed));
      WindowInfo window = CheckArmed(); CheckUnobscured(window);
      POINT target = new POINT { X = window.left + x, Y = window.top + y };
      if (Root(WindowFromPoint(target)) != attachedHandle) { Stop("target-occluded"); throw new ControlError("stopped", "O ponto de input pertence a outra janela."); }
      int virtualLeft = GetSystemMetrics(76), virtualTop = GetSystemMetrics(77), virtualWidth = GetSystemMetrics(78), virtualHeight = GetSystemMetrics(79);
      if (virtualWidth < 2 || virtualHeight < 2 || target.X < virtualLeft || target.Y < virtualTop || target.X >= virtualLeft + virtualWidth || target.Y >= virtualTop + virtualHeight) throw new ControlError("invalid-coordinate", "Ponto fora da tela virtual.");
      int nx = Math.Min(65535, (int)Math.Floor((target.X - virtualLeft + 0.5) * 65536.0 / virtualWidth));
      int ny = Math.Min(65535, (int)Math.Floor((target.Y - virtualTop + 0.5) * 65536.0 / virtualHeight));
      INPUT move = Mouse(nx, ny, 0x0001 | 0x8000 | 0x4000, 0);
      INPUT[] inputs = click ? new INPUT[] { move, Mouse(0, 0, 0x0002, 0), Mouse(0, 0, 0x0004, 0) }
        : new INPUT[] { move, Mouse(0, 0, 0x0800, unchecked((uint)(delta * 120))) };
      CheckArmed();
      if (Root(WindowFromPoint(target)) != attachedHandle) { Stop("target-occluded"); throw new ControlError("stopped", "O ponto de input mudou de janela; operacao recusada."); }
      // SendInput is global. Exclusive use plus immediate checks reduces, but cannot atomically eliminate, a focus race.
      uint sent = SendInput((uint)inputs.Length, inputs, Marshal.SizeOf(typeof(INPUT)));
      lastInput = Stopwatch.GetTimestamp();
      if (sent != inputs.Length) { Stop("input-refused"); throw new ControlError("stopped", "SendInput recusou parte/todo input; confira privilegios e jogo. Sem fallback."); }
      CheckArmed();
      if (Root(WindowFromPoint(target)) != attachedHandle) { Stop("target-changed"); throw new ControlError("stopped", "A janela sob o ponto mudou durante o input."); }
    }
    public ControlStatus Click(int x, int y) { lock (gate) { Input(x, y, 0, true); return Status(); } }
    public ControlStatus Scroll(int x, int y, int delta) { lock (gate) { Input(x, y, delta, false); return Status(); } }
    public void Dispose() {
      lock (gate) { if (closed) return; closed = true; armed = false; shutdown.Set(); }
      if (monitor != null && Thread.CurrentThread != monitor) monitor.Join(1000);
      shutdown.Dispose();
    }
  }
}
'@

Add-Type -TypeDefinition $source -ReferencedAssemblies System.Drawing,System.Core
if ($ValidateOnly) {
  [Console]::WriteLine('{"event":"validated","protocol":1}')
  exit 0
}

function Require-Integer($Value, [string]$Name) {
  if ($null -eq $Value -or ($Value -isnot [int] -and $Value -isnot [long]) -or $Value -gt [int]::MaxValue -or $Value -lt [int]::MinValue) {
    throw "Argumento inteiro requerido: $Name."
  }
  return [int]$Value
}

$control = $null
try {
  $processNames = @((ConvertFrom-Json $ProcessNamesJson) | ForEach-Object { [string]$_ })
  $control = New-Object GachaOcrWindows.GameControl($OutputRoot, $ExpectedWidth, $ExpectedHeight, [string[]]$processNames)
  [Console]::WriteLine('{"event":"ready","protocol":1}')
  $quit = $false
  while (-not $quit -and $null -ne ($line = [Console]::ReadLine())) {
    $request = $null
    try {
      if ($line.Length -gt 1048576) { throw 'Pedido excessivo.' }
      $request = ConvertFrom-Json $line
      $id = Require-Integer $request.id 'id'
      if ($id -le 0) { throw 'ID deve ser positivo.' }
      $arguments = $request.args
      $result = switch ([string]$request.op) {
        'list' { ,$control.List(); break }
        'attach' { $pidValue = 0; if ($null -ne $arguments.pid) { $pidValue = Require-Integer $arguments.pid 'pid'; if ($pidValue -le 0) { throw 'PID deve ser positivo.' } }; $control.Attach($pidValue); break }
        'activate' { $control.Activate(); break }
        'arm' { $control.Arm(); break }
        'status' { $control.Status(); break }
        'capture' { $control.Capture([string]$arguments.path); break }
        'click' { $control.Click((Require-Integer $arguments.x 'x'), (Require-Integer $arguments.y 'y')); break }
        'scroll' { $control.Scroll((Require-Integer $arguments.x 'x'), (Require-Integer $arguments.y 'y'), (Require-Integer $arguments.delta 'delta')); break }
        'close' { $control.Dispose(); $quit = $true; @{ closed = $true }; break }
        default { throw 'Operacao desconhecida.' }
      }
      $response = @{ id = $id; ok = $true; result = $result }
    } catch {
      $failure = $_.Exception.GetBaseException()
      $code = 'helper-error'
      if ($failure -is [GachaOcrWindows.ControlError]) { $code = $failure.Code }
      $response = @{ id = $(if ($null -ne $request) { $request.id } else { $null }); ok = $false; error = @{ code = $code; message = $failure.Message } }
    }
    [Console]::WriteLine((ConvertTo-Json -InputObject $response -Depth 12 -Compress))
  }
} finally { if ($null -ne $control) { $control.Dispose() } }
