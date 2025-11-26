import { Injectable } from '@angular/core';
import init, { Datahog, NodeWrapper } from 'datahog-npm';
// import init, { Datahog, Edge, EdgeID, NodeW, NodeID } from 'datahog-npm';
import { Subject } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class DataHogService {
  done: Subject<void> = new Subject();
  _dh?: Datahog;

  constructor() {
    // this._dh = Datahog.init('http://localhost:8080/api/v1');

    // Datahog.init('http://localhost:8080/api/v1').then((dh) => {
    //   console.log('Init');
    //   this._dh = dh;
    //   this.done.next();
    // });
    console.log(1);
    const url = new URL('datahog_npm_bg.wasm', import.meta.url);
    console.log(2);
    init(url).then(() => {
      console.log(3);
      // Datahog.new('http://localhost:8000/api/v1').then((dh) => {
      const dh = Datahog.init('http://localhost:8000/api/v1');
      console.log(dh);
      const nw = new NodeWrapper();
      console.log(nw);
      // Datahog.new('http://localhost:8000/api/v1').then((dh) => {
      //   console.log(4);
      //   this._dh = dh;
      //   this.done.next();
      // });
    });
  }

  // get rootNodeID(): NodeID {
  //   return this._dh!.root_id;
  // }

  // async getNode(id: NodeID): Promise<NodeW> {
  //   return this._dh!.get_node(id);
  // }

  // async getEdge(id: EdgeID): Promise<Edge> {
  //   return this._dh!.get_edge(id);
  // }

  // async updateNode(node: NodeW) {
  //   await this._dh?.update_node(node);
  // }

  // async updateEdge(edge: Edge) {
  //   await this._dh?.update_edge(edge);
  // }
}
