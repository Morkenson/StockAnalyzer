import { NgModule, ErrorHandler } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { HttpClientModule } from '@angular/common/http';
import { HTTP_INTERCEPTORS } from '@angular/common/http';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NgChartsModule } from 'ng2-charts';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { DashboardComponent } from './components/dashboard.component';
import { StockSearchComponent } from './components/stock-search.component';
import { StockDetailsComponent } from './components/shared/stock-details.component';
import { WatchlistComponent } from './components/watchlist.component';
import { AccountDetailComponent } from './components/account-detail.component';
import { PortfolioComponent } from './components/portfolio.component';
import { HeaderComponent } from './components/shared/header.component';
import { StockCardComponent } from './components/shared/stock-card.component';
import { StockChartComponent } from './components/shared/stock-chart.component';
import { LoginComponent } from './components/login.component';
import { SignupComponent } from './components/signup.component';
import { ForgotPasswordComponent } from './components/forgot-password.component';
import { ResetPasswordComponent } from './components/reset-password.component';
import { DebtCalculatorComponent } from './components/debt-calculator.component';
import { NetWorthComponent } from './components/net-worth.component';
import { IncomeExpensesComponent } from './components/income-expenses.component';
import { SettingsComponent } from './components/settings.component';
import { GlobalErrorHandler } from './services/global-error-handler.service';
import { AuthInterceptor } from './services/auth.interceptor';

@NgModule({
  declarations: [
    AppComponent,
    DashboardComponent,
    StockSearchComponent,
    StockDetailsComponent,
    WatchlistComponent,
    AccountDetailComponent,
    PortfolioComponent,
    HeaderComponent,
    StockCardComponent,
    StockChartComponent,
    LoginComponent,
    SignupComponent,
    ForgotPasswordComponent,
    ResetPasswordComponent,
    DebtCalculatorComponent,
    NetWorthComponent,
    IncomeExpensesComponent,
    SettingsComponent
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
  providers: [
    { provide: ErrorHandler, useClass: GlobalErrorHandler },
    { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true }
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }

