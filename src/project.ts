import * as path from "path";
import * as fs from "fs";
import * as crypto from "crypto";
import * as TS from "typescript";
import * as tsconfig from "tsconfig";
import { Registry } from "./registry";
import { Diagnostic } from "./diagnostic";
import { Output } from "./output";

const { assign } = Object;

export class Project {
  private readonly host: LanguageServiceHost;
  private readonly service: LanguageService;

  public constructor(root: string, registry: Registry) {
    this.host = new InMemoryLanguageServiceHost(root);
    this.service = TS.createLanguageService(this.host, registry);
  }

  private resolve(filename: string): string {
    return path.resolve(process.cwd(), filename);
  }

  public index(filename: string): void {
    this.host.addFile(filename);
  }

  public diagnose(filename: string): Array<Diagnostic> {
    filename = this.resolve(filename);

    const { service } = this;

    this.index(filename);

    const syntactic = service.getSyntacticDiagnostics(filename);
    const semantic = service.getSemanticDiagnostics(filename);

    return [...syntactic, ...semantic];
  }

  public compile(filename: string): Array<Output> {
    filename = this.resolve(filename);

    const { service } = this;

    this.index(filename);

    const { outputFiles } = service.getEmitOutput(filename);

    return outputFiles;
  }
}

function md5(input: string): string {
  return crypto
    .createHash("md5")
    .update(input)
    .digest("hex");
}

interface LanguageServiceHost extends TS.LanguageServiceHost {
  addFile(path: string): void;
  removeFile(path: string): void;
}

interface LanguageService extends TS.LanguageService {}

interface ScriptInfo {
  readonly version: string;
  readonly snapshot: TS.IScriptSnapshot;
  readonly kind: TS.ScriptKind;
}

class InMemoryLanguageServiceHost implements LanguageServiceHost {
  private readonly files: Map<string, ScriptInfo> = new Map();
  private readonly options: TS.CompilerOptions;

  private version: string = "";

  public constructor(root: string) {
    this.options = this.getOptions(root);
  }

  private getOptions(root: string): TS.CompilerOptions {
    const configPath = tsconfig.findSync(root);

    if (typeof configPath !== "string") {
      return {};
    }

    const { config } = TS.parseConfigFileTextToJson(
      configPath,
      fs.readFileSync(configPath, "utf8")
    );

    const { options } = TS.parseJsonConfigFileContent(
      config,
      TS.sys,
      path.dirname(configPath)
    );

    return options;
  }

  public getCompilationSettings(): TS.CompilerOptions {
    return this.options;
  }

  public getNewLine(): string {
    return "\n";
  }

  public getProjectVersion(): string {
    return this.version;
  }

  public getScriptFileNames(): Array<string> {
    return [...this.files.keys()];
  }

  public getScriptKind(fileName: string): TS.ScriptKind {
    const { kind } = this.files.get(fileName) || this.addFile(fileName);
    return kind;
  }

  public getScriptVersion(fileName: string): string {
    const { version } = this.files.get(fileName) || this.addFile(fileName);
    return version;
  }

  public getScriptSnapshot(fileName: string): TS.IScriptSnapshot {
    const { snapshot } = this.files.get(fileName) || this.addFile(fileName);
    return snapshot;
  }

  public getCurrentDirectory(): string {
    return process.cwd();
  }

  public getDefaultLibFileName(options: TS.CompilerOptions): string {
    return TS.getDefaultLibFilePath(options);
  }

  public useCaseSensitiveFileNames(): boolean {
    return false;
  }

  public readFile(
    fileName: string,
    encoding: string = "utf8"
  ): string | undefined {
    return fs.readFileSync(fileName, encoding);
  }

  public realpath(fileName: string): string {
    return fs.realpathSync(fileName);
  }

  public fileExists(fileName: string): boolean {
    return fs.existsSync(fileName);
  }

  public getDirectories(directoryName: string): Array<string> {
    if (!fs.existsSync(directoryName)) {
      return [];
    }

    return fs
      .readdirSync(directoryName)
      .filter(entry =>
        fs.statSync(path.join(directoryName, entry)).isDirectory()
      );
  }

  public addFile(fileName: string): ScriptInfo {
    const text = fs.readFileSync(fileName, "utf8");
    const version = md5(text);

    const current = this.files.get(fileName);

    if (current !== undefined && current.version === version) {
      return current;
    }

    const snapshot = TS.ScriptSnapshot.fromString(text);

    this.version = md5(this.version + version);

    let kind = TS.ScriptKind.Unknown;

    switch (path.extname(fileName)) {
      case ".js":
        kind = TS.ScriptKind.JS;
      case ".jsx":
        kind = TS.ScriptKind.JSX;
      case ".ts":
        kind = TS.ScriptKind.TS;
      case ".tsx":
        kind = TS.ScriptKind.TSX;
    }

    const file: ScriptInfo = { snapshot, version, kind };

    this.files.set(fileName, file);

    return file;
  }

  public removeFile(fileName: string): void {
    this.files.delete(fileName);
  }
}
