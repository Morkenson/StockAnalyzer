import { Component, Input, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { ChartConfiguration, ChartType } from 'chart.js';
import { StockHistoricalData } from '../../../models/stock.model';

@Component({
  selector: 'app-stock-chart',
  template: `
    <div class="chart-container">
      <canvas baseChart
        [data]="chartData"
        [options]="chartOptions"
        [type]="chartType">
      </canvas>
    </div>
  `,
  styles: []
})
export class StockChartComponent implements OnInit, OnChanges {
  @Input() historicalData: StockHistoricalData[] = [];

  chartType: ChartType = 'line';
  chartData: ChartConfiguration['data'] = {
    labels: [],
    datasets: []
  };

  chartOptions: ChartConfiguration['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'top'
      },
      tooltip: {
        mode: 'index',
        intersect: false
      }
    },
    scales: {
      x: {
        display: true,
        title: {
          display: true,
          text: 'Date'
        }
      },
      y: {
        display: true,
        title: {
          display: true,
          text: 'Price ($)'
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

    // Sort data by date
    const sortedData = [...this.historicalData].sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    // Prepare labels (dates)
    const labels = sortedData.map(d => {
      const date = new Date(d.date);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    });

    // Prepare datasets
    this.chartData = {
      labels: labels,
      datasets: [
        {
          label: 'Closing Price',
          data: sortedData.map(d => d.close),
          borderColor: 'rgb(102, 126, 234)',
          backgroundColor: 'rgba(102, 126, 234, 0.1)',
          fill: true,
          tension: 0.4,
          pointRadius: 2,
          pointHoverRadius: 5
        },
        {
          label: 'High',
          data: sortedData.map(d => d.high),
          borderColor: 'rgb(40, 167, 69)',
          backgroundColor: 'transparent',
          borderDash: [5, 5],
          pointRadius: 0,
          fill: false
        },
        {
          label: 'Low',
          data: sortedData.map(d => d.low),
          borderColor: 'rgb(220, 53, 69)',
          backgroundColor: 'transparent',
          borderDash: [5, 5],
          pointRadius: 0,
          fill: false
        }
      ]
    };
  }
}

