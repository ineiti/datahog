import { Routes } from '@angular/router';
import { nodeComponent } from './view/node/node.component';
import { SearchComponent } from './view/search/search.component';

export const routes: Routes = [
  { path: '', component: SearchComponent },
  { path: 'node/:nodeID', component: nodeComponent },
];
