'use client';

import {
  Chart as ChartJS,
  Filler,
  Legend,
  LineElement,
  PointElement,
  RadialLinearScale,
  Tooltip,
} from 'chart.js';
import { Radar } from 'react-chartjs-2';

import type { StudyPlannerMetric } from '@/lib/types';

ChartJS.register(RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

type RadarScoreCardProps = {
  metrics: StudyPlannerMetric[];
};

export function RadarScoreCard({ metrics }: RadarScoreCardProps) {
  return (
    <div className="rounded-[1.7rem] border border-[#DCE6F5] bg-white p-4 shadow-[0_18px_42px_-34px_rgba(20,41,95,0.18)]">
      <div className="mb-4">
        <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#7C8FB5]">진단 차트</p>
        <h3 className="mt-2 text-lg font-black tracking-tight text-[#17326B]">학습 패턴 5축 요약</h3>
      </div>
      <div className="h-[300px] sm:h-[320px]">
        <Radar
          data={{
            labels: metrics.map((metric) => metric.label),
            datasets: [
              {
                label: '이번 진단',
                data: metrics.map((metric) => metric.value),
                backgroundColor: 'rgba(255, 138, 31, 0.18)',
                borderColor: '#FF8A1F',
                borderWidth: 2,
                pointBackgroundColor: '#17326B',
                pointBorderColor: '#ffffff',
                pointRadius: 3.5,
              },
            ],
          }}
          options={{
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                display: false,
              },
              tooltip: {
                backgroundColor: '#17326B',
                titleColor: '#fff',
                bodyColor: '#fff',
                padding: 12,
              },
            },
            scales: {
              r: {
                beginAtZero: true,
                min: 0,
                max: 100,
                ticks: {
                  stepSize: 20,
                  color: '#577099',
                  backdropColor: 'transparent',
                  font: {
                    size: 11,
                    weight: 700,
                  },
                },
                pointLabels: {
                  color: '#17326B',
                  font: {
                    size: 12,
                    weight: 700,
                  },
                },
                grid: {
                  color: 'rgba(23,50,107,0.12)',
                },
                angleLines: {
                  color: 'rgba(23,50,107,0.12)',
                },
              },
            },
          }}
        />
      </div>
    </div>
  );
}
