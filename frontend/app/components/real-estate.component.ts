import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Subscription } from 'rxjs';
import { RealEstateService } from '../services/real-estate.service';
import {
  InvestmentAnalysis,
  RealEstateListing,
  RealEstateProperty,
  RentcastUsage
} from '../models/real-estate.model';

@Component({
  selector: 'app-real-estate',
  template: `
    <div class="real-estate">
      <section class="page-hero real-estate-hero">
        <div>
          <p class="page-kicker">Investing</p>
          <h1>Real Estate</h1>
          <p class="hero-subtitle">Search properties worldwide and analyze whether they're profitable investments.</p>
        </div>
        <button type="button" class="btn btn-primary" (click)="openAnalyzer()">
          Analyze a Property
        </button>
      </section>

      <!-- Property search -->
      <section class="card search-card">
        <div class="card-header">
          <div>
            <span>Search Properties</span>
            <p>Find listings by city or country, then send one to the analyzer</p>
          </div>
          <span class="usage-badge" *ngIf="usage && usage.configured"
                title="Live US searches use the RentCast API. Sample data is always free.">
            Live API: {{ usage.used }} of {{ usage.limit }} calls used · resets {{ usage.periodEnd | date:'MMM d' }}
          </span>
        </div>
        <div class="quota-warning" *ngIf="quotaExhausted">
          Monthly RentCast limit reached — searches show sample data until
          {{ usage ? (usage.periodEnd | date:'MMM d') : 'the next billing period' }}.
        </div>
        <form [formGroup]="searchForm" (ngSubmit)="search()" class="search-form">
          <div class="form-group search-location">
            <label for="location">Location</label>
            <input
              type="text"
              id="location"
              formControlName="location"
              placeholder="e.g., Lisbon, Tokyo, Mexico City..."
              class="form-input"
            />
          </div>
          <div class="form-group">
            <label for="minPrice">Min Price ($)</label>
            <input type="number" id="minPrice" formControlName="minPrice" placeholder="Any" min="0" class="form-input" />
          </div>
          <div class="form-group">
            <label for="maxPrice">Max Price ($)</label>
            <input type="number" id="maxPrice" formControlName="maxPrice" placeholder="Any" min="0" class="form-input" />
          </div>
          <div class="form-group">
            <label for="propertyType">Property Type</label>
            <select id="propertyType" formControlName="propertyType" class="form-input">
              <option value="">Any</option>
              <option value="Apartment">Apartment</option>
              <option value="Condo">Condo</option>
              <option value="Flat">Flat</option>
              <option value="Single Family">Single Family</option>
              <option value="Multi Family">Multi Family</option>
              <option value="Villa">Villa</option>
            </select>
          </div>
          <div class="form-group">
            <label for="minBedrooms">Min Beds</label>
            <input type="number" id="minBedrooms" formControlName="minBedrooms" placeholder="Any" min="0" step="1" class="form-input" />
          </div>
          <button type="submit" class="btn btn-primary search-submit" [disabled]="searching">
            {{ searching ? 'Searching...' : 'Search' }}
          </button>
        </form>

        <div class="search-results" *ngIf="searchPerformed">
          <div class="results-meta">
            <span class="results-count">{{ listings.length }} {{ listings.length === 1 ? 'property' : 'properties' }} found</span>
            <span class="sample-badge" *ngIf="searchSource === 'sample'" title="Configure RENTCAST_API_KEY for live US listings">
              Sample data
            </span>
            <span class="cached-badge" *ngIf="searchSource === 'rentcast' && resultCached"
                  [title]="'Reused a saved RentCast call — no API quota spent. Click Refresh for live data.'">
              Cached {{ resultCachedAt | date:'MMM d' }}
            </span>
            <button type="button" class="link-button"
                    *ngIf="searchSource === 'rentcast' && usage?.configured"
                    (click)="refreshSearch()"
                    [disabled]="searching"
                    title="Fetches live listings — uses 1 of your monthly API calls">
              {{ searching ? 'Refreshing...' : 'Refresh (uses 1 call)' }}
            </button>
          </div>
          <div class="listing-grid" *ngIf="listings.length > 0">
            <div class="listing-card" *ngFor="let listing of listings">
              <div class="listing-type">{{ listing.propertyType }}</div>
              <h3 class="listing-address">{{ listing.address }}</h3>
              <p class="listing-location">{{ listing.city }}, {{ listing.country }}</p>
              <div class="listing-price">\${{ listing.price | number:'1.0-0' }}</div>
              <div class="listing-specs">
                <span *ngIf="listing.bedrooms != null">{{ listing.bedrooms }} bd</span>
                <span *ngIf="listing.bathrooms != null">{{ listing.bathrooms }} ba</span>
                <span *ngIf="listing.areaSqm != null">{{ listing.areaSqm | number:'1.0-0' }} m²</span>
                <span *ngIf="listing.yearBuilt != null">Built {{ listing.yearBuilt }}</span>
              </div>
              <div class="listing-rent" *ngIf="listing.estimatedMonthlyRent != null">
                <span class="detail-label">Est. rent:</span>
                \${{ listing.estimatedMonthlyRent | number:'1.0-0' }}/mo
                <span class="listing-yield">({{ grossYield(listing) | number:'1.1-1' }}% gross yield)</span>
              </div>
              <div class="listing-actions">
                <button type="button" class="btn btn-primary btn-sm" (click)="analyzeListing(listing)">
                  Analyze
                </button>
                <a
                  *ngIf="hasExternalLink(listing.address, listing.city)"
                  class="btn btn-secondary btn-sm"
                  [href]="externalLinkUrl(listing.address, listing.city, listing.country)"
                  target="_blank"
                  rel="noopener noreferrer">
                  {{ externalLinkLabel(listing.country) }}
                </a>
              </div>
            </div>
          </div>
          <p class="empty-results" *ngIf="listings.length === 0">
            No properties matched your search. Try a broader location or price range.
          </p>
        </div>
      </section>

      <!-- Investment analyzer -->
      <section class="analyzer-section" *ngIf="showAnalyzer || editingPropertyId">
        <div class="analyzer-section-header">
          <h2>{{ editingPropertyId ? 'Edit Property Analysis' : 'Investment Analyzer' }}</h2>
          <button type="button" class="btn btn-secondary btn-sm" (click)="closeAnalyzer()">
            Close
          </button>
        </div>

        <div class="analyzer-container">
          <div class="card analyzer-form-card">
            <div class="card-header">
              <span>Property &amp; Financing</span>
            </div>
            <form [formGroup]="analyzerForm" (ngSubmit)="calculate()">
              <div class="form-group">
                <label for="propertyName">Property Name</label>
                <input type="text" id="propertyName" formControlName="name" placeholder="e.g., Lisbon Apartment" class="form-input" />
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label for="purchasePrice">Purchase Price ($)</label>
                  <input type="number" id="purchasePrice" formControlName="purchasePrice" placeholder="e.g., 350000" min="0" step="1000" class="form-input" />
                  <div class="form-error" *ngIf="analyzerForm.get('purchasePrice')?.hasError('required') && analyzerForm.get('purchasePrice')?.touched">
                    Purchase price is required
                  </div>
                </div>
                <div class="form-group">
                  <label for="downPaymentPct">Down Payment (%)</label>
                  <input type="number" id="downPaymentPct" formControlName="downPaymentPct" min="0" max="100" step="1" class="form-input" />
                </div>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label for="interestRate">Interest Rate (%)</label>
                  <input type="number" id="interestRate" formControlName="interestRate" min="0" max="100" step="0.01" class="form-input" />
                </div>
                <div class="form-group">
                  <label for="loanTermYears">Loan Term (years)</label>
                  <input type="number" id="loanTermYears" formControlName="loanTermYears" min="1" max="50" step="1" class="form-input" />
                </div>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label for="closingCosts">Closing Costs ($)</label>
                  <input type="number" id="closingCosts" formControlName="closingCosts" min="0" step="100" class="form-input" />
                </div>
                <div class="form-group">
                  <label for="monthlyRent">Monthly Rent ($)</label>
                  <input type="number" id="monthlyRent" formControlName="monthlyRent" placeholder="e.g., 1900" min="0" step="50" class="form-input" />
                  <div class="form-error" *ngIf="analyzerForm.get('monthlyRent')?.hasError('required') && analyzerForm.get('monthlyRent')?.touched">
                    Monthly rent is required
                  </div>
                </div>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label for="vacancyRatePct">Vacancy (%)</label>
                  <input type="number" id="vacancyRatePct" formControlName="vacancyRatePct" min="0" max="100" step="0.5" class="form-input" />
                </div>
                <div class="form-group">
                  <label for="propertyTaxAnnual">Property Tax ($/yr)</label>
                  <input type="number" id="propertyTaxAnnual" formControlName="propertyTaxAnnual" min="0" step="100" class="form-input" />
                </div>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label for="insuranceAnnual">Insurance ($/yr)</label>
                  <input type="number" id="insuranceAnnual" formControlName="insuranceAnnual" min="0" step="50" class="form-input" />
                </div>
                <div class="form-group">
                  <label for="hoaMonthly">HOA / Fees ($/mo)</label>
                  <input type="number" id="hoaMonthly" formControlName="hoaMonthly" min="0" step="10" class="form-input" />
                </div>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label for="maintenancePct">Maintenance (% of rent)</label>
                  <input type="number" id="maintenancePct" formControlName="maintenancePct" min="0" max="100" step="0.5" class="form-input" />
                </div>
                <div class="form-group">
                  <label for="managementPct">Management (% of rent)</label>
                  <input type="number" id="managementPct" formControlName="managementPct" min="0" max="100" step="0.5" class="form-input" />
                </div>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label for="otherMonthlyCosts">Other Costs ($/mo)</label>
                  <input type="number" id="otherMonthlyCosts" formControlName="otherMonthlyCosts" min="0" step="10" class="form-input" />
                </div>
                <div class="form-group">
                  <label for="appreciationPct">Appreciation (%/yr)</label>
                  <input type="number" id="appreciationPct" formControlName="appreciationPct" min="-20" max="50" step="0.1" class="form-input" />
                </div>
              </div>
              <div class="form-group">
                <label for="holdYears">Holding Period (years)</label>
                <input type="number" id="holdYears" formControlName="holdYears" min="1" max="50" step="1" class="form-input" />
              </div>
              <div class="form-group">
                <label for="reNotes">Notes (optional)</label>
                <textarea id="reNotes" formControlName="notes" placeholder="Add any notes about this property..." rows="2" class="form-input"></textarea>
              </div>

              <button type="submit" class="btn btn-primary btn-block" [disabled]="analyzerForm.invalid">
                Calculate Profitability
              </button>
              <button
                type="button"
                class="btn btn-secondary btn-block"
                *ngIf="analysis && !editingPropertyId"
                (click)="saveProperty()"
                [disabled]="savingProperty">
                {{ savingProperty ? 'Saving...' : 'Save Property' }}
              </button>
              <button
                type="button"
                class="btn btn-secondary btn-block"
                *ngIf="analysis && editingPropertyId"
                (click)="updateProperty()"
                [disabled]="savingProperty">
                {{ savingProperty ? 'Updating...' : 'Update Property' }}
              </button>
            </form>
          </div>

          <div class="card analysis-card" *ngIf="analysis">
            <div class="card-header">
              <span>Profitability Analysis</span>
            </div>
            <div class="verdict-banner" [ngClass]="'verdict-' + analysis.verdict">
              <span class="verdict-label">{{ verdictLabel(analysis.verdict) }}</span>
              <span class="verdict-detail">{{ verdictDetail(analysis.verdict) }}</span>
            </div>
            <div class="metrics-grid">
              <div class="result-item">
                <span class="result-label">Monthly Cash Flow</span>
                <span class="result-value" [class.positive]="analysis.monthlyCashFlow >= 0" [class.negative]="analysis.monthlyCashFlow < 0">
                  \${{ analysis.monthlyCashFlow | number:'1.2-2' }}
                </span>
              </div>
              <div class="result-item">
                <span class="result-label">Cash-on-Cash Return</span>
                <span class="result-value" [class.positive]="analysis.cashOnCashReturn >= 0" [class.negative]="analysis.cashOnCashReturn < 0">
                  {{ analysis.cashOnCashReturn | number:'1.2-2' }}%
                </span>
              </div>
              <div class="result-item">
                <span class="result-label">Cap Rate</span>
                <span class="result-value">{{ analysis.capRate | number:'1.2-2' }}%</span>
              </div>
              <div class="result-item">
                <span class="result-label">Monthly Mortgage</span>
                <span class="result-value">\${{ analysis.monthlyMortgage | number:'1.2-2' }}</span>
              </div>
              <div class="result-item">
                <span class="result-label">Annual NOI</span>
                <span class="result-value">\${{ analysis.noiAnnual | number:'1.0-0' }}</span>
              </div>
              <div class="result-item">
                <span class="result-label">Cash Needed Upfront</span>
                <span class="result-value">\${{ analysis.totalCashInvested | number:'1.0-0' }}</span>
              </div>
              <div class="result-item">
                <span class="result-label">Gross Rent Multiplier</span>
                <span class="result-value">{{ analysis.grossRentMultiplier | number:'1.1-1' }}</span>
              </div>
              <div class="result-item">
                <span class="result-label">1% Rule</span>
                <span class="result-value" [class.positive]="analysis.onePercentRule" [class.negative]="!analysis.onePercentRule">
                  {{ analysis.onePercentRule ? 'Pass' : 'Fail' }}
                </span>
              </div>
            </div>
            <div class="projection-block">
              <h4>After {{ analyzerForm.value.holdYears }} years</h4>
              <div class="metrics-grid">
                <div class="result-item">
                  <span class="result-label">Projected Value</span>
                  <span class="result-value">\${{ analysis.projectedValue | number:'1.0-0' }}</span>
                </div>
                <div class="result-item">
                  <span class="result-label">Equity</span>
                  <span class="result-value">\${{ analysis.equityAtHold | number:'1.0-0' }}</span>
                </div>
                <div class="result-item">
                  <span class="result-label">Total Profit</span>
                  <span class="result-value" [class.positive]="analysis.totalReturnAtHold >= 0" [class.negative]="analysis.totalReturnAtHold < 0">
                    \${{ analysis.totalReturnAtHold | number:'1.0-0' }}
                  </span>
                </div>
                <div class="result-item">
                  <span class="result-label">Annualized ROI</span>
                  <span class="result-value" [class.positive]="analysis.annualizedRoi >= 0" [class.negative]="analysis.annualizedRoi < 0">
                    {{ analysis.annualizedRoi | number:'1.2-2' }}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Saved properties -->
      <section class="card saved-properties-card">
        <div class="card-header saved-properties-header">
          <div class="saved-properties-title">
            <span>Saved Properties</span>
            <span class="card-badge" *ngIf="properties.length > 0">{{ properties.length }}</span>
          </div>
          <button type="button" class="btn btn-primary" (click)="openAnalyzer()">
            Analyze a Property
          </button>
        </div>
        <div class="properties-list" *ngIf="properties.length > 0">
          <div class="property-item" *ngFor="let property of properties">
            <div class="property-header">
              <div class="property-name-section">
                <h3>{{ property.name }}</h3>
                <span class="property-location" *ngIf="property.city || property.country">
                  {{ propertyLocation(property) }}
                </span>
              </div>
              <div class="property-actions">
                <span class="verdict-pill" [ngClass]="'verdict-' + propertyVerdict(property)">
                  {{ verdictLabel(propertyVerdict(property)) }}
                </span>
                <a
                  *ngIf="hasExternalLink(property.address, property.city)"
                  class="btn btn-sm btn-secondary"
                  [href]="externalLinkUrl(property.address, property.city, property.country)"
                  target="_blank"
                  rel="noopener noreferrer"
                  [title]="externalLinkLabel(property.country)">
                  {{ externalLinkLabel(property.country) }}
                </a>
                <button class="btn btn-sm btn-secondary" (click)="editProperty(property)" title="Edit property">
                  Edit
                </button>
                <button class="btn btn-sm btn-danger" (click)="deleteProperty(property.id)" title="Delete property">
                  Delete
                </button>
              </div>
            </div>
            <div class="property-details">
              <div class="property-detail-item">
                <span class="detail-label">Price:</span>
                <span class="detail-value">\${{ property.purchasePrice | number:'1.0-0' }}</span>
              </div>
              <div class="property-detail-item">
                <span class="detail-label">Rent:</span>
                <span class="detail-value">\${{ property.monthlyRent | number:'1.0-0' }}/mo</span>
              </div>
              <div class="property-detail-item">
                <span class="detail-label">Cash Flow:</span>
                <span class="detail-value" [class.positive]="property.monthlyCashFlow >= 0" [class.negative]="property.monthlyCashFlow < 0">
                  \${{ property.monthlyCashFlow | number:'1.2-2' }}/mo
                </span>
              </div>
              <div class="property-detail-item">
                <span class="detail-label">Cap Rate:</span>
                <span class="detail-value">{{ property.capRate | number:'1.2-2' }}%</span>
              </div>
              <div class="property-detail-item">
                <span class="detail-label">Cash-on-Cash:</span>
                <span class="detail-value">{{ property.cashOnCashReturn | number:'1.2-2' }}%</span>
              </div>
            </div>
            <div class="property-notes" *ngIf="property.notes">
              <span class="notes-label">Notes:</span>
              <span class="notes-text">{{ property.notes }}</span>
            </div>
          </div>
        </div>
        <div class="empty-properties" *ngIf="properties.length === 0">
          <p class="empty-properties-message">No saved properties yet. Search for a listing or analyze one manually to get started.</p>
          <button type="button" class="btn btn-primary" (click)="openAnalyzer()">Analyze a Property</button>
        </div>
      </section>
    </div>
  `,
  styles: [`
    .search-form {
      display: grid;
      grid-template-columns: 2fr 1fr 1fr 1fr 1fr auto;
      gap: var(--spacing-md);
      align-items: end;
    }
    .search-submit {
      margin-bottom: var(--spacing-md);
    }
    .results-meta {
      display: flex;
      align-items: center;
      gap: var(--spacing-sm);
      margin-bottom: var(--spacing-md);
    }
    .sample-badge {
      font-size: var(--font-size-xs);
      padding: 2px 8px;
      border-radius: 999px;
      background: var(--color-bg-tertiary, rgba(255, 255, 255, 0.08));
      border: 1px solid var(--color-border);
      color: var(--color-text-secondary);
    }
    .usage-badge {
      font-size: var(--font-size-xs);
      padding: 2px 10px;
      border-radius: 999px;
      border: 1px solid var(--color-border);
      color: var(--color-text-secondary);
      white-space: nowrap;
    }
    .cached-badge {
      font-size: var(--font-size-xs);
      padding: 2px 8px;
      border-radius: 999px;
      border: 1px solid rgba(34, 197, 94, 0.4);
      color: #22c55e;
      white-space: nowrap;
    }
    .link-button {
      background: none;
      border: none;
      color: var(--color-primary, #6366f1);
      font-size: var(--font-size-xs);
      cursor: pointer;
      padding: 0;
      text-decoration: underline;
    }
    .link-button:disabled {
      opacity: 0.6;
      cursor: default;
    }
    .quota-warning {
      padding: var(--spacing-sm) var(--spacing-md);
      margin-bottom: var(--spacing-md);
      border: 1px solid rgba(234, 179, 8, 0.5);
      border-radius: var(--border-radius-md, 8px);
      color: #eab308;
      font-size: var(--font-size-sm);
    }
    .listing-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
      gap: var(--spacing-md);
    }
    .listing-card {
      border: 1px solid var(--color-border);
      border-radius: var(--border-radius-md, 8px);
      padding: var(--spacing-md);
      display: flex;
      flex-direction: column;
      gap: var(--spacing-xs);
    }
    .listing-type {
      font-size: var(--font-size-xs);
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--color-text-secondary);
    }
    .listing-address {
      margin: 0;
      font-size: var(--font-size-md, 1rem);
    }
    .listing-location {
      margin: 0;
      color: var(--color-text-secondary);
      font-size: var(--font-size-sm);
    }
    .listing-price {
      font-size: var(--font-size-lg, 1.25rem);
      font-weight: 700;
    }
    .listing-specs {
      display: flex;
      gap: var(--spacing-sm);
      color: var(--color-text-secondary);
      font-size: var(--font-size-sm);
    }
    .listing-rent {
      font-size: var(--font-size-sm);
      margin-bottom: var(--spacing-sm);
    }
    .listing-yield {
      color: var(--color-text-secondary);
    }
    .listing-actions {
      display: flex;
      gap: var(--spacing-sm);
      margin-top: auto;
    }
    .listing-actions .btn {
      flex: 1;
      text-align: center;
    }
    a.btn {
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }
    .empty-results {
      color: var(--color-text-secondary);
    }
    .analyzer-section-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: var(--spacing-md);
    }
    .analyzer-container {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: var(--spacing-lg);
      align-items: start;
      margin-bottom: var(--spacing-lg);
    }
    .form-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: var(--spacing-md);
    }
    .verdict-banner {
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding: var(--spacing-md);
      border-radius: var(--border-radius-md, 8px);
      margin-bottom: var(--spacing-md);
      border: 1px solid var(--color-border);
    }
    .verdict-banner .verdict-label {
      font-weight: 700;
      font-size: var(--font-size-lg, 1.1rem);
    }
    .verdict-banner .verdict-detail {
      font-size: var(--font-size-sm);
      color: var(--color-text-secondary);
    }
    .verdict-profitable { border-color: rgba(34, 197, 94, 0.5); }
    .verdict-profitable .verdict-label { color: #22c55e; }
    .verdict-marginal { border-color: rgba(234, 179, 8, 0.5); }
    .verdict-marginal .verdict-label { color: #eab308; }
    .verdict-unprofitable { border-color: rgba(239, 68, 68, 0.5); }
    .verdict-unprofitable .verdict-label { color: #ef4444; }
    .metrics-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: var(--spacing-sm) var(--spacing-md);
    }
    .projection-block {
      margin-top: var(--spacing-md);
      padding-top: var(--spacing-md);
      border-top: 1px solid var(--color-border);
    }
    .projection-block h4 {
      margin: 0 0 var(--spacing-sm) 0;
    }
    .result-value.positive, .detail-value.positive { color: #22c55e; }
    .result-value.negative, .detail-value.negative { color: #ef4444; }
    .saved-properties-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .saved-properties-title {
      display: flex;
      align-items: center;
      gap: var(--spacing-sm);
    }
    .property-item {
      border: 1px solid var(--color-border);
      border-radius: var(--border-radius-md, 8px);
      padding: var(--spacing-md);
      margin-bottom: var(--spacing-md);
    }
    .property-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: var(--spacing-md);
      margin-bottom: var(--spacing-sm);
    }
    .property-name-section h3 {
      margin: 0;
    }
    .property-location {
      color: var(--color-text-secondary);
      font-size: var(--font-size-sm);
    }
    .property-actions {
      display: flex;
      align-items: center;
      gap: var(--spacing-sm);
    }
    .verdict-pill {
      font-size: var(--font-size-xs);
      padding: 2px 10px;
      border-radius: 999px;
      border: 1px solid var(--color-border);
    }
    .verdict-pill.verdict-profitable { color: #22c55e; border-color: rgba(34, 197, 94, 0.5); }
    .verdict-pill.verdict-marginal { color: #eab308; border-color: rgba(234, 179, 8, 0.5); }
    .verdict-pill.verdict-unprofitable { color: #ef4444; border-color: rgba(239, 68, 68, 0.5); }
    .property-details {
      display: flex;
      flex-wrap: wrap;
      gap: var(--spacing-sm) var(--spacing-lg);
    }
    .property-notes {
      margin-top: var(--spacing-sm);
      font-size: var(--font-size-sm);
      color: var(--color-text-secondary);
    }
    .empty-properties {
      text-align: center;
      padding: var(--spacing-lg);
    }
    @media (max-width: 900px) {
      .search-form {
        grid-template-columns: 1fr 1fr;
      }
      .search-location {
        grid-column: 1 / -1;
      }
      .analyzer-container {
        grid-template-columns: 1fr;
      }
    }
  `]
})
export class RealEstateComponent implements OnInit, OnDestroy {
  searchForm: FormGroup;
  analyzerForm: FormGroup;

  listings: RealEstateListing[] = [];
  searchSource: 'sample' | 'rentcast' = 'sample';
  searching = false;
  searchPerformed = false;
  resultCached = false;
  resultCachedAt: string | null = null;
  usage: RentcastUsage | null = null;
  quotaExhausted = false;

  analysis: InvestmentAnalysis | null = null;
  showAnalyzer = false;
  editingPropertyId: string | null = null;
  savingProperty = false;

  properties: RealEstateProperty[] = [];
  private propertiesSubscription?: Subscription;

  constructor(
    private fb: FormBuilder,
    private realEstateService: RealEstateService,
    private cdr: ChangeDetectorRef
  ) {
    this.searchForm = this.fb.group({
      location: [''],
      minPrice: [null],
      maxPrice: [null],
      propertyType: [''],
      minBedrooms: [null]
    });
    this.analyzerForm = this.fb.group({
      name: [''],
      address: [''],
      city: [''],
      country: [''],
      propertyType: [''],
      purchasePrice: ['', [Validators.required, Validators.min(1)]],
      downPaymentPct: [20, [Validators.required, Validators.min(0), Validators.max(100)]],
      closingCosts: [0, [Validators.min(0)]],
      interestRate: [6.5, [Validators.required, Validators.min(0)]],
      loanTermYears: [30, [Validators.required, Validators.min(1)]],
      monthlyRent: ['', [Validators.required, Validators.min(0)]],
      vacancyRatePct: [5, [Validators.min(0), Validators.max(100)]],
      propertyTaxAnnual: [0, [Validators.min(0)]],
      insuranceAnnual: [0, [Validators.min(0)]],
      hoaMonthly: [0, [Validators.min(0)]],
      maintenancePct: [5, [Validators.min(0), Validators.max(100)]],
      managementPct: [8, [Validators.min(0), Validators.max(100)]],
      otherMonthlyCosts: [0, [Validators.min(0)]],
      appreciationPct: [3],
      holdYears: [10, [Validators.required, Validators.min(1)]],
      notes: ['']
    });
  }

  ngOnInit(): void {
    this.propertiesSubscription = this.realEstateService.properties$.subscribe(properties => {
      this.properties = properties;
    });
    this.loadUsage();
  }

  private async loadUsage(): Promise<void> {
    try {
      this.usage = await this.realEstateService.getUsage();
      this.quotaExhausted = !!this.usage?.configured && this.usage.remaining <= 0;
      this.cdr.detectChanges();
    } catch {
      this.usage = null;
    }
  }

  ngOnDestroy(): void {
    this.propertiesSubscription?.unsubscribe();
  }

  grossYield(listing: RealEstateListing): number {
    if (!listing.price || listing.estimatedMonthlyRent == null) {
      return 0;
    }
    return (listing.estimatedMonthlyRent * 12 / listing.price) * 100;
  }

  refreshSearch(): Promise<void> {
    return this.search(true);
  }

  async search(refresh = false): Promise<void> {
    this.searching = true;
    try {
      const value = this.searchForm.value;
      const result = await this.realEstateService.searchListings({
        location: value.location?.trim() || undefined,
        minPrice: value.minPrice ?? undefined,
        maxPrice: value.maxPrice ?? undefined,
        propertyType: value.propertyType || undefined,
        minBedrooms: value.minBedrooms ?? undefined,
        refresh: refresh || undefined
      });
      this.listings = result.listings;
      this.searchSource = result.source;
      this.resultCached = !!result.cached;
      this.resultCachedAt = result.cachedAt ?? null;
      this.searchPerformed = true;
      if (result.usage) {
        this.usage = result.usage;
      }
      this.quotaExhausted = !!result.quotaExhausted || (!!this.usage?.configured && this.usage.remaining <= 0);
    } catch (error) {
      console.error('Error searching listings:', error);
      this.listings = [];
      this.searchPerformed = true;
    } finally {
      this.searching = false;
      this.cdr.detectChanges();
    }
  }

  analyzeListing(listing: RealEstateListing): void {
    this.showAnalyzer = true;
    this.editingPropertyId = null;
    this.analysis = null;
    this.analyzerForm.patchValue({
      name: `${listing.address}, ${listing.city}`,
      address: listing.address,
      city: listing.city,
      country: listing.country,
      propertyType: listing.propertyType,
      purchasePrice: listing.price,
      closingCosts: Math.round(listing.price * 0.03),
      monthlyRent: listing.estimatedMonthlyRent ?? '',
      propertyTaxAnnual: listing.propertyTaxRatePct != null ? Math.round(listing.price * listing.propertyTaxRatePct / 100) : 0,
      insuranceAnnual: Math.round(listing.price * 0.004)
    });
    this.calculate();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  calculate(): void {
    if (this.analyzerForm.invalid) {
      this.analyzerForm.markAllAsTouched();
      this.analysis = null;
      return;
    }
    const v = this.analyzerForm.value;
    this.analysis = this.computeAnalysis({
      purchasePrice: Number(v.purchasePrice),
      downPaymentPct: Number(v.downPaymentPct) || 0,
      closingCosts: Number(v.closingCosts) || 0,
      interestRate: Number(v.interestRate) || 0,
      loanTermYears: Number(v.loanTermYears) || 30,
      monthlyRent: Number(v.monthlyRent) || 0,
      vacancyRatePct: Number(v.vacancyRatePct) || 0,
      propertyTaxAnnual: Number(v.propertyTaxAnnual) || 0,
      insuranceAnnual: Number(v.insuranceAnnual) || 0,
      hoaMonthly: Number(v.hoaMonthly) || 0,
      maintenancePct: Number(v.maintenancePct) || 0,
      managementPct: Number(v.managementPct) || 0,
      otherMonthlyCosts: Number(v.otherMonthlyCosts) || 0,
      appreciationPct: Number(v.appreciationPct) || 0,
      holdYears: Number(v.holdYears) || 10
    });
  }

  private computeAnalysis(inputs: {
    purchasePrice: number; downPaymentPct: number; closingCosts: number;
    interestRate: number; loanTermYears: number; monthlyRent: number;
    vacancyRatePct: number; propertyTaxAnnual: number; insuranceAnnual: number;
    hoaMonthly: number; maintenancePct: number; managementPct: number;
    otherMonthlyCosts: number; appreciationPct: number; holdYears: number;
  }): InvestmentAnalysis {
    const downPayment = inputs.purchasePrice * inputs.downPaymentPct / 100;
    const loanAmount = inputs.purchasePrice - downPayment;
    const totalCashInvested = downPayment + inputs.closingCosts;

    const monthlyRate = inputs.interestRate / 100 / 12;
    const termMonths = inputs.loanTermYears * 12;
    let monthlyMortgage = 0;
    if (loanAmount > 0) {
      monthlyMortgage = monthlyRate === 0
        ? loanAmount / termMonths
        : loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, termMonths)) / (Math.pow(1 + monthlyRate, termMonths) - 1);
    }

    const effectiveMonthlyRent = inputs.monthlyRent * (1 - inputs.vacancyRatePct / 100);
    const monthlyOperatingExpenses =
      inputs.propertyTaxAnnual / 12 +
      inputs.insuranceAnnual / 12 +
      inputs.hoaMonthly +
      inputs.monthlyRent * inputs.maintenancePct / 100 +
      inputs.monthlyRent * inputs.managementPct / 100 +
      inputs.otherMonthlyCosts;

    const noiAnnual = (effectiveMonthlyRent - monthlyOperatingExpenses) * 12;
    const monthlyCashFlow = effectiveMonthlyRent - monthlyOperatingExpenses - monthlyMortgage;
    const annualCashFlow = monthlyCashFlow * 12;
    const capRate = inputs.purchasePrice > 0 ? (noiAnnual / inputs.purchasePrice) * 100 : 0;
    const cashOnCashReturn = totalCashInvested > 0 ? (annualCashFlow / totalCashInvested) * 100 : 0;
    const grossRentMultiplier = inputs.monthlyRent > 0 ? inputs.purchasePrice / (inputs.monthlyRent * 12) : 0;
    const onePercentRule = inputs.monthlyRent >= inputs.purchasePrice * 0.01;

    const projectedValue = inputs.purchasePrice * Math.pow(1 + inputs.appreciationPct / 100, inputs.holdYears);
    const holdMonths = Math.min(inputs.holdYears * 12, termMonths);
    let loanBalanceAtHold = 0;
    if (loanAmount > 0 && holdMonths < termMonths) {
      if (monthlyRate === 0) {
        loanBalanceAtHold = loanAmount - monthlyMortgage * holdMonths;
      } else {
        const growth = Math.pow(1 + monthlyRate, holdMonths);
        loanBalanceAtHold = loanAmount * growth - monthlyMortgage * (growth - 1) / monthlyRate;
      }
      loanBalanceAtHold = Math.max(0, loanBalanceAtHold);
    }
    const equityAtHold = projectedValue - loanBalanceAtHold;
    const totalReturnAtHold = equityAtHold + annualCashFlow * inputs.holdYears - totalCashInvested;
    let annualizedRoi = 0;
    if (totalCashInvested > 0) {
      const endingMultiple = (totalReturnAtHold + totalCashInvested) / totalCashInvested;
      annualizedRoi = endingMultiple > 0
        ? (Math.pow(endingMultiple, 1 / inputs.holdYears) - 1) * 100
        : -100;
    }

    let verdict: InvestmentAnalysis['verdict'];
    if (monthlyCashFlow > 0 && cashOnCashReturn >= 4) {
      verdict = 'profitable';
    } else if (monthlyCashFlow >= 0 || annualizedRoi >= 6) {
      verdict = 'marginal';
    } else {
      verdict = 'unprofitable';
    }

    return {
      loanAmount,
      downPayment,
      totalCashInvested,
      monthlyMortgage,
      effectiveMonthlyRent,
      monthlyOperatingExpenses,
      noiAnnual,
      monthlyCashFlow,
      annualCashFlow,
      capRate,
      cashOnCashReturn,
      grossRentMultiplier,
      onePercentRule,
      projectedValue,
      loanBalanceAtHold,
      equityAtHold,
      totalReturnAtHold,
      annualizedRoi,
      verdict
    };
  }

  verdictLabel(verdict: 'profitable' | 'marginal' | 'unprofitable'): string {
    switch (verdict) {
      case 'profitable': return 'Profitable';
      case 'marginal': return 'Marginal';
      default: return 'Not Profitable';
    }
  }

  verdictDetail(verdict: 'profitable' | 'marginal' | 'unprofitable'): string {
    switch (verdict) {
      case 'profitable':
        return 'Positive cash flow with a solid cash-on-cash return.';
      case 'marginal':
        return 'Close to break-even — returns depend heavily on appreciation.';
      default:
        return 'Negative cash flow and weak long-term returns at these numbers.';
    }
  }

  propertyLocation(property: RealEstateProperty): string {
    return [property.city, property.country].filter(Boolean).join(', ');
  }

  private isUsLocation(country?: string | null): boolean {
    const normalized = (country || '').trim().toLowerCase();
    return normalized === 'united states' || normalized === 'usa' || normalized === 'us';
  }

  /** Address-based deep link: Zillow for US listings, Google Maps elsewhere. */
  externalLinkUrl(address?: string | null, city?: string | null, country?: string | null): string {
    const parts: string[] = [];
    if (address) {
      parts.push(address);
    }
    if (city && !(address || '').toLowerCase().includes(city.toLowerCase())) {
      parts.push(city);
    }
    if (country && !this.isUsLocation(country)) {
      parts.push(country);
    }
    const query = encodeURIComponent(parts.join(', '));
    return this.isUsLocation(country)
      ? `https://www.zillow.com/homes/${query}_rb/`
      : `https://www.google.com/maps/search/?api=1&query=${query}`;
  }

  externalLinkLabel(country?: string | null): string {
    return this.isUsLocation(country) ? 'View on Zillow' : 'View on Maps';
  }

  hasExternalLink(address?: string | null, city?: string | null): boolean {
    return !!(address || city);
  }

  propertyVerdict(property: RealEstateProperty): 'profitable' | 'marginal' | 'unprofitable' {
    if (property.monthlyCashFlow > 0 && property.cashOnCashReturn >= 4) {
      return 'profitable';
    }
    if (property.monthlyCashFlow >= 0) {
      return 'marginal';
    }
    return 'unprofitable';
  }

  openAnalyzer(): void {
    this.showAnalyzer = true;
    this.editingPropertyId = null;
    this.analysis = null;
    this.resetAnalyzerForm();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  closeAnalyzer(): void {
    this.showAnalyzer = false;
    this.editingPropertyId = null;
    this.analysis = null;
    this.resetAnalyzerForm();
  }

  editProperty(property: RealEstateProperty): void {
    this.showAnalyzer = true;
    this.editingPropertyId = property.id;
    this.analyzerForm.patchValue({
      name: property.name,
      address: property.address || '',
      city: property.city || '',
      country: property.country || '',
      propertyType: property.propertyType || '',
      purchasePrice: property.purchasePrice,
      downPaymentPct: property.downPaymentPct,
      closingCosts: property.closingCosts,
      interestRate: property.interestRate,
      loanTermYears: property.loanTermYears,
      monthlyRent: property.monthlyRent,
      vacancyRatePct: property.vacancyRatePct,
      propertyTaxAnnual: property.propertyTaxAnnual,
      insuranceAnnual: property.insuranceAnnual,
      hoaMonthly: property.hoaMonthly,
      maintenancePct: property.maintenancePct,
      managementPct: property.managementPct,
      otherMonthlyCosts: property.otherMonthlyCosts,
      appreciationPct: property.appreciationPct,
      holdYears: property.holdYears,
      notes: property.notes || ''
    });
    this.calculate();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async saveProperty(): Promise<void> {
    if (!this.analysis) {
      return;
    }
    this.savingProperty = true;
    try {
      await this.realEstateService.createProperty(this.buildPayload());
      this.closeAnalyzer();
    } catch (error: any) {
      console.error('Error saving property:', error);
      const detail = error?.error?.detail || error?.error?.message || error?.message || 'Unknown error';
      alert('Failed to save property: ' + detail);
    } finally {
      this.savingProperty = false;
      this.cdr.detectChanges();
    }
  }

  async updateProperty(): Promise<void> {
    if (!this.editingPropertyId || !this.analysis) {
      return;
    }
    this.savingProperty = true;
    try {
      await this.realEstateService.updateProperty(this.editingPropertyId, this.buildPayload());
      this.closeAnalyzer();
    } catch (error: any) {
      console.error('Error updating property:', error);
      const detail = error?.error?.detail || error?.error?.message || error?.message || 'Unknown error';
      alert('Failed to update property: ' + detail);
    } finally {
      this.savingProperty = false;
      this.cdr.detectChanges();
    }
  }

  async deleteProperty(propertyId: string): Promise<void> {
    if (!confirm('Are you sure you want to delete this property?')) {
      return;
    }
    try {
      await this.realEstateService.deleteProperty(propertyId);
    } catch (error: any) {
      console.error('Error deleting property:', error);
      const detail = error?.error?.detail || error?.error?.message || error?.message || 'Unknown error';
      alert('Failed to delete property: ' + detail);
    }
  }

  private buildPayload() {
    const v = this.analyzerForm.value;
    const analysis = this.analysis!;
    return {
      name: v.name?.trim() || `Property ${this.properties.length + 1}`,
      address: v.address?.trim() || undefined,
      city: v.city?.trim() || undefined,
      country: v.country?.trim() || undefined,
      propertyType: v.propertyType?.trim() || undefined,
      currency: 'USD',
      purchasePrice: Number(v.purchasePrice),
      downPaymentPct: Number(v.downPaymentPct) || 0,
      closingCosts: Number(v.closingCosts) || 0,
      interestRate: Number(v.interestRate) || 0,
      loanTermYears: Number(v.loanTermYears) || 30,
      monthlyRent: Number(v.monthlyRent) || 0,
      vacancyRatePct: Number(v.vacancyRatePct) || 0,
      propertyTaxAnnual: Number(v.propertyTaxAnnual) || 0,
      insuranceAnnual: Number(v.insuranceAnnual) || 0,
      hoaMonthly: Number(v.hoaMonthly) || 0,
      maintenancePct: Number(v.maintenancePct) || 0,
      managementPct: Number(v.managementPct) || 0,
      otherMonthlyCosts: Number(v.otherMonthlyCosts) || 0,
      appreciationPct: Number(v.appreciationPct) || 0,
      holdYears: Number(v.holdYears) || 10,
      monthlyCashFlow: Math.round(analysis.monthlyCashFlow * 100) / 100,
      capRate: Math.round(analysis.capRate * 10000) / 10000,
      cashOnCashReturn: Math.round(analysis.cashOnCashReturn * 10000) / 10000,
      notes: v.notes?.trim() || undefined
    };
  }

  private resetAnalyzerForm(): void {
    this.analyzerForm.reset({
      name: '',
      address: '',
      city: '',
      country: '',
      propertyType: '',
      purchasePrice: null,
      downPaymentPct: 20,
      closingCosts: 0,
      interestRate: 6.5,
      loanTermYears: 30,
      monthlyRent: null,
      vacancyRatePct: 5,
      propertyTaxAnnual: 0,
      insuranceAnnual: 0,
      hoaMonthly: 0,
      maintenancePct: 5,
      managementPct: 8,
      otherMonthlyCosts: 0,
      appreciationPct: 3,
      holdYears: 10,
      notes: ''
    });
  }
}
