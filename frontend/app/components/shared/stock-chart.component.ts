import { Component, Input, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { ChartConfiguration, ChartType } from 'chart.js';
import { StockHistoricalData } from '../../models/stock.model';

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
        [type]="chartType"
        [attr.aria-label]="ariaLabel">
      </canvas>
    </div>
  `,
})
export class StockChartComponent implements OnInit, OnChanges {
  @Input() historicalData: StockHistoricalData[] = [];
  @Input() valueLabel = 'Price';
  @Input() ariaLabel = 'Stock price chart';

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
    layout: {
      padding: {
        top: 12,
        right: 6,
        bottom: 2,
        left: 2
      }
    },
    elements: {
      line: {
        borderCapStyle: 'butt',
        borderJoinStyle: 'miter'
      },
      point: {
        hoverBorderWidth: 2
      }
    },
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        mode: 'index',
        intersect: false,
        backgroundColor: 'rgba(11, 14, 19, 0.94)',
        borderColor: 'rgba(94, 234, 212, 0.24)',
        borderWidth: 1,
        bodySpacing: 6,
        boxPadding: 6,
        caretPadding: 10,
        caretSize: 7,
        cornerRadius: 8,
        displayColors: false,
        padding: {
          top: 10,
          right: 12,
          bottom: 10,
          left: 12
        },
        titleColor: '#f7f4ee',
        bodyColor: '#c9d0d8',
        titleFont: {
          size: 15,
          weight: 'bold'
        },
        bodyFont: {
          size: 12,
          weight: 'normal'
        },
        callbacks: {
          title: (tooltipItems) => {
            const value = tooltipItems[0]?.parsed.y;

            if (value === null || value === undefined) {
              return `${this.valueLabel}: N/A`;
            }

            return this.formatTooltipMoney(value);
          },
          label: (context) => {
            const index = context.dataIndex;
            
            if (index < 0 || index >= this.sortedData.length) {
              return '';
            }

            return this.formatTooltipDate(new Date(this.sortedData[index].date));
          }
        }
      }
    },
    scales: {
      x: {
        display: true,
        border: {
          display: false
        },
        grid: {
          display: false
        },
        ticks: {
          autoSkip: true,
          color: '#7b8491',
          font: {
            size: 11,
            weight: 600
          },
          maxRotation: 0,
          maxTicksLimit: 8,
          padding: 8
        }
      },
      y: {
        position: 'right',
        border: {
          display: false
        },
        grid: {
          drawTicks: false,
          color: 'rgba(17, 24, 39, 0.11)',
          lineWidth: 1
        },
        ticks: {
          color: '#64707d',
          font: {
            size: 11,
            weight: 650
          },
          padding: 10,
          maxTicksLimit: 7,
          callback: (value) => {
            return '$' + Number(value).toFixed(2);
          }
        }
      }
    },
    interaction: {
      mode: 'index',
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

    const firstDate = new Date(this.sortedData[0].date);
    const lastDate = new Date(this.sortedData[this.sortedData.length - 1].date);
    const rangeMs = lastDate.getTime() - firstDate.getTime();
    const oneDayMs = 24 * 60 * 60 * 1000;

    const labels = this.sortedData.map(d => {
      const date = new Date(d.date);
      if (rangeMs <= oneDayMs * 2) {
        return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
      }
      if (rangeMs >= oneDayMs * 330) {
        return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      }
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    });

    const firstClose = this.sortedData[0].close;
    const lastClose = this.sortedData[this.sortedData.length - 1].close;
    const lineColor = lastClose >= firstClose ? '#00b806' : '#f04a17';
    const fillColor = lastClose >= firstClose ? 'rgba(0, 184, 6, 0.1)' : 'rgba(240, 74, 23, 0.1)';

    this.chartData = {
      labels: labels,
      datasets: [
        {
          label: this.valueLabel,
          data: this.sortedData.map(d => d.close),
          borderColor: lineColor,
          backgroundColor: fillColor,
          fill: true,
          tension: 0,
          borderWidth: 2.4,
          pointRadius: 0,
          pointHoverRadius: 4,
          pointBackgroundColor: lineColor,
          pointBorderColor: '#ffffff',
          pointBorderWidth: 2,
          pointHitRadius: 18
        }
      ]
    };
  }

  private formatTooltipMoney(value: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      currencyDisplay: 'narrowSymbol',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  }

  private formatTooltipDate(date: Date): string {
    const hasTime = date.getHours() !== 0 || date.getMinutes() !== 0 || date.getSeconds() !== 0;
    const dateText = date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });

    if (!hasTime) {
      return dateText;
    }

    const timeText = date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit'
    });

    return `${dateText}, ${timeText}`;
  }
}

