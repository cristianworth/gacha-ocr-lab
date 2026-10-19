using System;
using System.Diagnostics;
using System.IO;
using System.Security.Principal;
using System.Text;

internal static class Launcher
{
    private static bool childRunning;
    private static readonly string Root = AppDomain.CurrentDomain.BaseDirectory;
    private static readonly string[] Commands = {
        "--capture --delay 5",
        "--limit 10 --delay 5",
        "--full --delay 5"
    };

    private static string FindNode()
    {
        string[] standard = {
            Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "nodejs", "node.exe"),
            Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), "nodejs", "node.exe")
        };
        foreach (string path in standard)
            if (File.Exists(path)) return path;
        foreach (string entry in (Environment.GetEnvironmentVariable("PATH") ?? "").Split(Path.PathSeparator))
        {
            string directory = entry.Trim().Trim('"');
            if (directory.Length == 0) continue;
            try
            {
                string path = Path.Combine(directory, "node.exe");
                if (File.Exists(path)) return Path.GetFullPath(path);
            }
            catch (ArgumentException) { }
        }
        throw new FileNotFoundException("Node.js nao encontrado. Instale Node.js 22+ e abra novamente.");
    }

    private static string CheckInstallation()
    {
        if (!File.Exists(Path.Combine(Root, "src", "scan-cli.js")) ||
            !File.Exists(Path.Combine(Root, "package.json")))
            throw new InvalidOperationException("Mantenha o .exe na raiz do gacha-ocr-lab. Para outro local, crie um atalho.");
        if (!Directory.Exists(Path.Combine(Root, "node_modules", "sharp")) ||
            !Directory.Exists(Path.Combine(Root, "node_modules", "tesseract.js")))
            throw new InvalidOperationException("Dependencias ausentes. Execute npm.cmd ci na pasta do projeto.");
        return FindNode();
    }

    private static int Main(string[] args)
    {
        Console.OutputEncoding = Encoding.UTF8;
        Console.CancelKeyPress += delegate(object sender, ConsoleCancelEventArgs e) {
            // Node receives the same console signal and saves the partial session.
            if (childRunning) e.Cancel = true;
        };
        try
        {
            if (args.Length > 1 || (args.Length == 1 && args[0] != "--check" && args[0] != "--help"))
                throw new ArgumentException("Opcoes do lancador: --check ou --help. Os scans sao escolhidos pelo menu.");
            if (args.Length == 1 && args[0] == "--help")
            {
                Console.WriteLine("Abra gacha-ocr-lab.exe na raiz do projeto e escolha uma acao.");
                Console.WriteLine("--check verifica a instalacao sem capturar ou enviar inputs.");
                return 0;
            }
            string node = CheckInstallation();
            bool elevated;
            using (WindowsIdentity identity = WindowsIdentity.GetCurrent())
                elevated = new WindowsPrincipal(identity).IsInRole(WindowsBuiltInRole.Administrator);
            Console.WriteLine("Gacha OCR Lab - Genshin / Weapons");
            Console.WriteLine("Projeto: " + Root);
            Console.WriteLine("Administrador: " + (elevated ? "sim" : "nao"));
            Console.WriteLine("Node: " + node);
            Console.WriteLine("Resultados: " + Path.Combine(Root, "data", "sessions"));
            if (args.Length == 1)
            {
                foreach (string command in Commands)
                    Console.WriteLine("node src/scan-cli.js " + command);
                Console.WriteLine("Verificacao concluida. Nenhuma captura ou input executado.");
                return 0;
            }
            if (!elevated)
                throw new InvalidOperationException("Abra o executavel com permissao de Administrador.");
            while (true)
            {
                Console.WriteLine();
                Console.WriteLine("Prepare Genshin em ingles, cliente 1440x900, Weapons, Quality decrescente e topo.");
                Console.WriteLine("Libere mouse/teclado durante a coleta. Segure F8 para interromper.");
                Console.WriteLine("1 - Captura e diagnostico (sem cliques)");
                Console.WriteLine("2 - Piloto de ate 10 armas (sem rolagem)");
                Console.WriteLine("3 - Coleta completa de armas 4/5 estrelas (com rolagem)");
                Console.WriteLine("0 - Sair");
                Console.Write("Escolha: ");
                string choice = Console.ReadLine();
                if (choice == null || choice.Trim() == "0") return 0;
                int selected;
                if (!Int32.TryParse(choice.Trim(), out selected) || selected < 1 || selected > Commands.Length)
                {
                    Console.WriteLine("Opcao invalida.");
                    continue;
                }
                Console.WriteLine("Executando: node src/scan-cli.js " + Commands[selected - 1]);
                ProcessStartInfo info = new ProcessStartInfo {
                    FileName = node,
                    Arguments = "\"" + Path.Combine(Root, "src", "scan-cli.js") + "\" " + Commands[selected - 1],
                    WorkingDirectory = Root,
                    UseShellExecute = false
                };
                int code;
                childRunning = true;
                try
                {
                    using (Process child = Process.Start(info))
                    {
                        child.WaitForExit();
                        code = child.ExitCode;
                    }
                }
                finally { childRunning = false; }
                Console.WriteLine("Script encerrado (codigo " + code + "). Confira os caminhos e mensagens acima.");
                Console.WriteLine("Codigo 0 significa arquivos salvos; nao confirma cobertura nem revisao humana.");
            }
        }
        catch (Exception error)
        {
            Console.Error.WriteLine("Erro: " + error.Message);
            if (args.Length == 0 && !Console.IsInputRedirected)
            {
                Console.WriteLine("Pressione Enter para fechar.");
                Console.ReadLine();
            }
            return 1;
        }
    }
}
