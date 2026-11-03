using System;
using System.Diagnostics;
using System.IO;
using System.Windows.Forms;

internal static class DesktopLauncher
{
    [STAThread]
    private static int Main(string[] args)
    {
        string root = AppDomain.CurrentDomain.BaseDirectory;
        string entry = Path.Combine(root, "scan-desktop.cmd");
        bool check = args.Length == 1 && args[0] == "--check";
        try
        {
            if (args.Length != 0 && !check) return 2;
            if (!File.Exists(entry) || !File.Exists(Path.Combine(root, "scripts", "start-desktop.ps1")))
                throw new FileNotFoundException("Mantenha gacha-ocr-zzz.exe junto de scan-desktop.cmd e da pasta scripts.");
            if (check) return 0;
            using (Process child = Process.Start(new ProcessStartInfo {
                FileName = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.System), "cmd.exe"),
                Arguments = "/d /s /c \"\"" + entry + "\"\"",
                WorkingDirectory = root,
                UseShellExecute = false,
                CreateNoWindow = true
            })) { }
            return 0;
        }
        catch (Exception error)
        {
            if (!check) MessageBox.Show(error.Message, "Gacha OCR Lab");
            return 1;
        }
    }
}
