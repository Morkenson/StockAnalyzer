import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { HttpClientModule } from '@angular/common/http';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NgChartsModule } from 'ng2-charts';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { DashboardComponent } from './components/dashboard.component';
import { StockSearchComponent } from './components/stock-search.component';
import { StockDetailsComponent } from './components/shared/stock-details/stock-details.component';
import { WatchlistComponent } from './components/watchlist.component';
import { PortfolioComponent } from './components/portfolio.component';
import { HeaderComponent } from './components/shared/header/header.component';
import { StockCardComponent } from './components/shared/stock-card/stock-card.component';
import { StockChartComponent } from './components/shared/stock-chart/stock-chart.component';
import { LoginComponent } from './components/login/login.component';
import { SignupComponent } from './components/signup/signup.component';

@NgModule({
  declarations: [
    AppComponent,
    DashboardComponent,
    StockSearchComponent,
    StockDetailsComponent,
    WatchlistComponent,
    PortfolioComponent,
    HeaderComponent,
    StockCardComponent,
    StockChartComponent,
    LoginComponent,
    SignupComponent
  ],
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    AppRoutingModule,
    HttpClientModule,
    FormsModule,
    ReactiveFormsModule,
    NgChartsModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }

