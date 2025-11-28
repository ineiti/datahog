import { Injectable } from '@angular/core';
import init, { Datahog, Edge, EdgeID, Node, NodeID } from 'datahog-npm';
import { Subject } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class DataHogService {
  done: Subject<void> = new Subject();
  _dh?: Datahog;

  constructor() {
    this.initDataHog();
  }

  async initDataHog() {
    const url = new URL('datahog_npm_bg.wasm', import.meta.url);
    await init(url);
    try {
      this._dh = await Datahog.init('http://localhost:8000/api/v1');
    } catch (e) {
      console.error(`Couldn't connect to backend: ${e}`);
      this._dh = await Datahog.init_local();
    }
    this.done.next();
  }

  get rootNodeID(): NodeID {
    return this._dh!.root_id;
  }

  async getNode(id: NodeID): Promise<Node> {
    return this._dh!.get_node(id);
  }

  async getEdge(id: EdgeID): Promise<Edge> {
    return this._dh!.get_edge(id);
  }

  async updateNode(node: Node) {
    await this._dh?.update_node(node);
  }

  async updateEdge(edge: Edge) {
    await this._dh?.update_edge(edge);
  }
}
