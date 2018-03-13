import * as TS from "typescript";
import { Diagnostic } from "./diagnostic";
import { Output } from "./output";
import { Registry } from "./registry";
import { Project } from "./project";
import { getRoot } from "./helpers";

export class Workspace {
  private readonly projects: Map<string, Project> = new Map();
  private readonly registry: Registry;

  public constructor() {
    this.registry = TS.createDocumentRegistry(false, process.cwd());
  }

  private projectFor(filename: string): Project {
    const root = getRoot(filename);

    if (root === null) {
      throw new Error(`${filename} has no associated TypeScript configuration`);
    }

    let project = this.projects.get(root);

    if (project === undefined) {
      project = new Project(root, this.registry);
      this.projects.set(root, project);
    }

    return project;
  }

  public diagnose(filename: string): Array<Diagnostic> {
    return this.projectFor(filename).diagnose(filename);
  }

  public compile(filename: string): Array<Output> {
    return this.projectFor(filename).compile(filename);
  }
}
