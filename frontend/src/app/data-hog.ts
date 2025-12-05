import { Injectable } from '@angular/core';
import { OutputBlockData } from '@editorjs/editorjs';
import init, { Datahog, DataNode, Edge, EdgeID, Node, NodeID } from 'datahog-npm';
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
    } catch (_) {
      console.warn(`Couldn't connect to backend - using localstorage`);
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

  async searchNodes(search: string): Promise<Node[]> {
    return (await this._dh?.search_nodes(search)) || [];
  }

  async searchLabels(search: string): Promise<Node[]> {
    return (await this.searchNodes(search)).filter((n) => n.kind === 'Label');
  }

  static blocksToDataNode(blocks: OutputBlockData[]): DataNode {
    const block = blocks.shift();
    if (block === undefined) {
      return new DataNode('empty');
    }
    const dn = new DataNode(`${JSON.stringify(block)}`);
    if (blocks.length > 0) {
      dn.set_sibling(DataHogService.blocksToDataNode(blocks));
    }
    return dn;
  }

  static dataNodeToBlocks(dn: DataNode): OutputBlockData[] {
    const bds = dn.sibling.length > 0 ? DataHogService.dataNodeToBlocks(dn.sibling[0]) : [];
    try {
      let bd = JSON.parse(dn.data);
      if (bd.id === undefined || bd.type === undefined || bd.data === undefined) {
        bd = { type: 'paragraph', data: { text: dn.data } };
      }
      bds.unshift(bd);
    } catch (e) {
      console.warn(`Couldn't parse JSON of dataNode: ${e}`);
    }
    return bds;
  }
}
