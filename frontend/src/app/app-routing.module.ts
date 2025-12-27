import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { DashboardComponent } from './components/dashboard.component';
import { StockSearchComponent } from './components/stock-search.component';
import { StockDetailsComponent } from './components/shared/stock-details.component';
import { WatchlistComponent } from './components/watchlist.component';
import { PortfolioComponent } from './components/portfolio.component';
import { LoginComponent } from './components/login.component';
import { SignupComponent } from './components/signup.component';
import { AuthGuard } from './guards/auth.guard';

const routes: Routes = [
  { path: '', redirectTo: '/dashboard', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  { path: 'signup', component: SignupComponent },
  { path: 'dashboard', component: DashboardComponent, canActivate: [AuthGuard] },
  { path: 'search', component: StockSearchComponent, canActivate: [AuthGuard] },
  { path: 'stock/:symbol', component: StockDetailsComponent, canActivate: [AuthGuard] },
  { path: 'watchlist', component: WatchlistComponent, canActivate: [AuthGuard] },
  { path: 'portfolio', component: PortfolioComponent, canActivate: [AuthGuard] },
  { path: '**', redirectTo: '/dashboard' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }

