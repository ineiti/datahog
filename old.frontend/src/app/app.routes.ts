import { Routes } from '@angular/router';
import { OverViewComponent } from './over-view/over-view.component';
import { BoardViewComponent } from './board-view/board-view.component';

export const routes: Routes = [
    { path: '', redirectTo: 'over-view', pathMatch: 'full' },
    { path: 'over-view', component: OverViewComponent },
    { path: 'over-view/:nodeID', component: OverViewComponent },
    { path: 'board-view', component: BoardViewComponent }
];