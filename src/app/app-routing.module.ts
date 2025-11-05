import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { StockSearchComponent } from './components/stock-search/stock-search.component';
import { StockDetailsComponent } from './components/stock-details/stock-details.component';
import { WatchlistComponent } from './components/watchlist/watchlist.component';

const routes: Routes = [
  { path: '', redirectTo: '/dashboard', pathMatch: 'full' },
  { path: 'dashboard', component: DashboardComponent },
  { path: 'search', component: StockSearchComponent },
  { path: 'stock/:symbol', component: StockDetailsComponent },
  { path: 'watchlist', component: WatchlistComponent },
  { path: '**', redirectTo: '/dashboard' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }

