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

  public diagnose(filename: string): Array<Diagnostic> {
    filename = this.resolve(filename);

    const { service, host } = this;

    host.addFile(filename);

    const syntactic = service.getSyntacticDiagnostics(filename);
    const semantic = service.getSemanticDiagnostics(filename);

    return [...syntactic, ...semantic];
  }

  public compile(filename: string): Array<Output> {
    filename = this.resolve(filename);

    const { service, host } = this;

    host.addFile(filename);

    const { outputFiles } = service.getEmitOutput(filename);

    return outputFiles;
  }
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
  private readonly root: string;

  public constructor(cwd: string) {
    const configPath = tsconfig.findSync(cwd);

    if (typeof configPath !== "string") {
      throw new Error(`${cwd} contains no TypeScript configuration`);
    }

    const root = path.dirname(configPath);

    const { config } = TS.parseConfigFileTextToJson(
      configPath,
      fs.readFileSync(configPath, "utf8")
    );

    const { options } = TS.parseJsonConfigFileContent(config, TS.sys, root);

    this.options = options;
    this.root = root;
  }

  public useCaseSensitiveFileNames(): boolean {
    return TS.sys.useCaseSensitiveFileNames;
  }

  public getNewLine(): string {
    return TS.sys.newLine;
  }

  public getDefaultLibFileName(options: TS.CompilerOptions): string {
    return TS.getDefaultLibFilePath(options);
  }

  public getScriptFileNames(): Array<string> {
    return [...this.files.keys()];
  }

  public getScriptVersion(fileName: string): string {
    const { version } = this.files.get(fileName) || this.addFile(fileName);
    return version;
  }

  public getScriptSnapshot(fileName: string): TS.IScriptSnapshot {
    const { snapshot } = this.files.get(fileName) || this.addFile(fileName);
    return snapshot;
  }

  public getScriptKind(fileName: string): TS.ScriptKind {
    const { kind } = this.files.get(fileName) || this.addFile(fileName);
    return kind;
  }

  public getCompilationSettings(): TS.CompilerOptions {
    return this.options;
  }

  public getCurrentDirectory(): string {
    return this.root;
  }

  public readFile(fileName: string, encoding?: string): string | undefined {
    return TS.sys.readFile(fileName, encoding);
  }

  public fileExists(fileName: string): boolean {
    return TS.sys.fileExists(fileName);
  }

  public realpath(fileName: string): string {
    return TS.sys.realpath ? TS.sys.realpath(fileName) : fileName;
  }

  public readDirectory(
    directoryName: string,
    extensions?: ReadonlyArray<string>,
    exclude?: ReadonlyArray<string>,
    include?: ReadonlyArray<string>,
    depth?: number
  ): Array<string> {
    return TS.sys.readDirectory(
      directoryName,
      extensions,
      exclude,
      include,
      depth
    );
  }

  public getDirectories(directoryName: string): Array<string> {
    if (!this.fileExists(directoryName)) {
      return [];
    }

    return TS.sys
      .getDirectories(directoryName)
      .map(directoryName => path.basename(directoryName));
  }

  public addFile(fileName: string): ScriptInfo {
    const text = fs.readFileSync(fileName, "utf8");
    const snapshot = TS.ScriptSnapshot.fromString(text);
    const version = crypto
      .createHash("md5")
      .update(text)
      .digest("hex");

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

    const file = { snapshot, version, kind };

    this.files.set(fileName, file);

    return file;
  }

  public removeFile(fileName: string): void {
    this.files.delete(fileName);
  }
}
