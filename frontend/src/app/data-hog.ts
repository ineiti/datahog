import { Injectable } from '@angular/core';
import init, { Datahog, Edge, EdgeID, NodeID, Transaction } from 'datahog-npm';
import { Subject, Subscriber } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class DataHogService {
  done: Subject<void> = new Subject();
  _dh?: Datahog;

  constructor() {
    const url = new URL('datahog_npm_bg.wasm', import.meta.url);
    init(url).then(() => {
      Datahog.new().then((dh) => {
        this._dh = dh;
        this.done.next();
      })
    })
  }

  get rootNodeID(): NodeID {
    return this._dh!.rootNodeID;
  }

  async getNode(id: NodeID): Promise<Subject<Node>> {
    const s: Subject<Node> = new Subject();
    this._dh!.get_node(id, (node: Node) => s.next(node));
    return s;
  }

  async getEdge(id: EdgeID): Promise<Subject<Edge>> {
    const s: Subject<Edge> = new Subject();
    this._dh!.get_edge(id, (edge: Edge) => s.next(edge));
    return s;
  }

}
