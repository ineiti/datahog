import { Injectable } from '@angular/core';
import { Node } from 'vis-network/standalone';

@Injectable({
  providedIn: 'root'
})
export class DataService {
  index: Index;
  entries: Map<string, Data> = new Map<string, Data>();

  constructor() {
    localStorage.getItem('index') ? this.index = JSON.parse(localStorage.getItem('index')!) : this.index = { keys: [] };
    for (const key of this.index.keys) {
      const data = localStorage.getItem(key);
      if (data) {
        this.entries.set(key, Data.fromJson(data));
      }
    }
    if (this.index.keys.length === 0) {
      let root = new DataLabel("Root").newData("Root", []);
      let rootView = new DataView("graph", root.id, "Root View").newData("Root View");
      root.links.push({ to: rootView.id, linkType: "contains" });
      this.setData(root);
      this.setData(rootView);
    }
  }

  setData(data: Data): Data {
    if (data.id === "") {
      data.id = DataService.getId();
    }
    this.entries.set(data.id, data);
    this.index.keys.push(data.id);
    localStorage.setItem('index', JSON.stringify(this.index));
    localStorage.setItem(data.id, JSON.stringify(data));
    return data;
  }

  rmData(id: string): void {
    this.entries.delete(id);
    this.entries.forEach((value, key) => {
      value.links = value.links.filter(link => link.to !== id);
      localStorage.setItem(key, JSON.stringify(value));
    });
    this.index.keys = this.index.keys.filter(key => key !== id);
    localStorage.setItem('index', JSON.stringify(this.index));
    localStorage.removeItem(id);
  }

  static getId(): string {
    const array = new Uint8Array(32);
    window.crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }
}

export class Data {
  static fromJson(json: string): Data {
    const data = JSON.parse(json);
    return new Data(data.id, data.dataType, data.label, data.data, data.links);
  }

  constructor(public id: string,
    public dataType: "view" | "label" | "checkbox" | "markdown",
    public label: string,
    public data: string,
    public links: Link[]) { }

  getData(): DataView | DataLabel | DataCheckbox | DataMarkdown {
    switch (this.dataType) {
      case "view":
        let view = JSON.parse(this.data);
        return new DataView(view.viewType, view.rootNode, view.title);
      case "label":
        let label = JSON.parse(this.data);
        return new DataLabel(label.description);
      case "checkbox":
        let checkbox = JSON.parse(this.data);
        return new DataCheckbox(checkbox.content, checkbox.checked);
      case "markdown":
        let markdown = JSON.parse(this.data);
        return new DataMarkdown(markdown.content);
      default:
        throw new Error("Unknown data type");
    }
  }

  getLabel(): DataLabel {
    if (this.dataType !== "label") {
      throw new Error("Data is not a label");
    }
    return this.getData() as DataLabel;
  }

  getView(): DataView | undefined {
    if (this.dataType !== "view") {
      return undefined;
    }
    return this.getData() as DataView;
  }

  getCheckbox(): DataCheckbox {
    if (this.dataType !== "checkbox") {
      throw new Error("Data is not a checkbox");
    }
    return this.getData() as DataCheckbox;
  }

  getMarkdown(): DataMarkdown {
    if (this.dataType !== "markdown") {
      throw new Error("Data is not a markdown");
    }
    return this.getData() as DataMarkdown;
  }

  getNode(): Node {
    const parsedData = JSON.parse(this.data);
    switch (this.dataType) {
      case "view":
        return {
          id: this.id,
          label: this.label,
          color: '#dd8888',
          shape: 'box',
        };
      case "label":
        return {
          id: this.id,
          label: this.label,
          color: '#88dd88',
          shape: 'circle',
        };
      case "checkbox":
        return {
          id: this.id,
          label: this.label,
          color: '#8888dd',
          shape: 'diamond',
        };
      case "markdown":
        return {
          id: this.id,
          label: this.label,
          color: '#dddd88',
          shape: 'box',
        };
    }
  }
}

export class DataView {
  constructor(public viewType: "graph" | "board" | "list" | "markdown",
    public rootNode: string,
    public title: string) { }

  newData(label = this.title, links: Link[] = []): Data {
    return new Data(DataService.getId(), "view", label, JSON.stringify(this), links);
  }
}

export class DataLabel {
  constructor(public description: string) { }

  newData(label = this.description, links: Link[] = []): Data {
    return new Data(DataService.getId(), "label", label, JSON.stringify(this), links);
  }
}

export class DataCheckbox {
  constructor(public content: string,
    public checked: boolean) { }

  newData(label = this.content, links: Link[] = []): Data {
    return new Data(DataService.getId(), "checkbox", label, JSON.stringify(this), links);
  }
}

export class DataMarkdown {
  constructor(public content: string) { }

  newData(label = this.content, links: Link[] = []): Data {
    return new Data(DataService.getId(), "markdown", label, JSON.stringify(this), links);
  }
}

export interface Link {
  to: string,
  linkType: "contains" | "isA",
}

export interface Index {
  keys: string[],
}

