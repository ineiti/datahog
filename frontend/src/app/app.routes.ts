import { Routes } from '@angular/router';
import { nodeComponent } from './view/node/node.component';

export const routes: Routes = [
  { path: 'node/:nodeID', component: nodeComponent },
];
