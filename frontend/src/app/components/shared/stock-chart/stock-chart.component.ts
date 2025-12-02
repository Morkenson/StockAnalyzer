import { Component, Input, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { ChartConfiguration, ChartType } from 'chart.js';
import { StockHistoricalData } from '../../../models/stock.model';

@Component({
  selector: 'app-stock-chart',
  template: `
    <div class="chart-container">
      <div *ngIf="historicalData.length === 0" class="chart-empty">
        <p>No historical data available</p>
      </div>
      <canvas *ngIf="historicalData.length > 0" baseChart
        [data]="chartData"
        [options]="chartOptions"
        [type]="chartType">
      </canvas>
    </div>
  `,
  styles: [`
    .chart-container {
      position: relative;
      width: 100%;
      height: 300px;
      padding: var(--spacing-sm);
    }

    .chart-empty {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100%;
      color: var(--color-text-secondary);
    }

    @media (max-width: 768px) {
      .chart-container {
        height: 250px;
        padding: var(--spacing-xs);
      }
    }
  `]
})
export class StockChartComponent implements OnInit, OnChanges {
  @Input() historicalData: StockHistoricalData[] = [];

  chartType: ChartType = 'line';
  chartData: ChartConfiguration['data'] = {
    labels: [],
    datasets: []
  };
  
  // Store sorted data for tooltip access
  private sortedData: StockHistoricalData[] = [];

  chartOptions: ChartConfiguration['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        mode: 'index',
        intersect: false,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        padding: 12,
        titleFont: {
          size: 14,
          weight: 'bold'
        },
        bodyFont: {
          size: 12
        },
        callbacks: {
          title: (tooltipItems) => {
            const index = tooltipItems[0].dataIndex;
            if (index >= 0 && index < this.sortedData.length) {
              const date = new Date(this.sortedData[index].date);
              return date.toLocaleDateString('en-US', { 
                weekday: 'short',
                month: 'short', 
                day: 'numeric',
                year: 'numeric'
              });
            }
            return '';
          },
          label: (context) => {
            const index = context.dataIndex;
            const value = context.parsed.y;
            
            if (value === null || value === undefined || index < 0 || index >= this.sortedData.length) {
              return `${context.dataset.label}: N/A`;
            }
            
            const dataPoint = this.sortedData[index];
            
            // Show closing price in the main label
            if (context.datasetIndex === 0) {
              return [
                `Close: $${value.toFixed(2)}`,
                `Open: $${dataPoint.open.toFixed(2)}`,
                `High: $${dataPoint.high.toFixed(2)}`,
                `Low: $${dataPoint.low.toFixed(2)}`,
                `Volume: ${dataPoint.volume.toLocaleString()}`
              ];
            }
            
            return `${context.dataset.label}: $${value.toFixed(2)}`;
          }
        }
      }
    },
    scales: {
      x: {
        display: true,
        title: {
          display: true,
          text: 'Date',
          font: {
            size: 12,
            weight: 'bold'
          }
        },
        grid: {
          display: false
        }
      },
      y: {
        display: true,
        title: {
          display: true,
          text: 'Price ($)',
          font: {
            size: 12,
            weight: 'bold'
          }
        },
        grid: {
          color: 'rgba(0, 0, 0, 0.05)'
        },
        ticks: {
          callback: (value) => {
            return '$' + Number(value).toFixed(2);
          }
        }
      }
    },
    interaction: {
      mode: 'nearest',
      axis: 'x',
      intersect: false
    }
  };

  ngOnInit(): void {
    this.updateChart();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['historicalData'] && !changes['historicalData'].firstChange) {
      this.updateChart();
    }
  }

  private updateChart(): void {
    if (!this.historicalData || this.historicalData.length === 0) {
      return;
    }

    // Sort data by date and store for tooltip access
    this.sortedData = [...this.historicalData].sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    // Prepare labels (dates)
    const labels = this.sortedData.map(d => {
      const date = new Date(d.date);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    });

    // Prepare datasets - only show closing price line
    this.chartData = {
      labels: labels,
      datasets: [
        {
          label: 'Price',
          data: this.sortedData.map(d => d.close),
          borderColor: 'rgb(102, 126, 234)',
          backgroundColor: 'rgba(102, 126, 234, 0.1)',
          fill: true,
          tension: 0.4,
          pointRadius: 3,
          pointHoverRadius: 6,
          pointBackgroundColor: 'rgb(102, 126, 234)',
          pointBorderColor: '#fff',
          pointBorderWidth: 2
        }
      ]
    };
  }
}

