import { useMemo } from "react";

interface DataPoint {
  label: string;
  value: number;
  color?: string;
}

interface FuturisticChartProps {
  data: DataPoint[];
  type: "bar" | "radial" | "line";
  title?: string;
  height?: number;
}

export function FuturisticChart({ data, type, title, height = 200 }: FuturisticChartProps) {
  const maxValue = useMemo(() => Math.max(...data.map(d => d.value)), [data]);
  
  const colors = ["#001D34", "#D7BB7D", "#6A7984", "#B8B4B4", "#1a3a4f"];

  if (type === "bar") {
    return (
      <div className="w-full" data-testid="chart-bar">
        {title && <h3 className="text-sm font-semibold text-foreground mb-4">{title}</h3>}
        <div className="flex items-end justify-between gap-2" style={{ height }}>
          {data.map((item, index) => {
            const barHeight = (item.value / maxValue) * 100;
            const color = item.color || colors[index % colors.length];
            return (
              <div key={item.label} className="flex flex-col items-center flex-1 h-full justify-end">
                <div className="w-full relative">
                  <div 
                    className="w-full rounded-t-sm transition-all duration-700 ease-out relative overflow-hidden"
                    style={{ 
                      height: `${(barHeight / 100) * height}px`,
                      backgroundColor: color,
                    }}
                  >
                    <div 
                      className="absolute inset-0 bg-gradient-to-t from-transparent to-white/20"
                    />
                    <div 
                      className="absolute bottom-0 left-0 right-0 h-1 bg-white/30"
                    />
                  </div>
                </div>
                <span className="text-xs text-muted-foreground mt-2 text-center truncate w-full">
                  {item.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (type === "radial") {
    const total = data.reduce((sum, d) => sum + d.value, 0);
    let cumulativeAngle = 0;

    return (
      <div className="w-full flex flex-col items-center" data-testid="chart-radial">
        {title && <h3 className="text-sm font-semibold text-foreground mb-4">{title}</h3>}
        <div className="relative" style={{ width: height, height }}>
          <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
            {data.map((item, index) => {
              const angle = (item.value / total) * 360;
              const startAngle = cumulativeAngle;
              cumulativeAngle += angle;
              
              const largeArcFlag = angle > 180 ? 1 : 0;
              const startRad = (startAngle * Math.PI) / 180;
              const endRad = ((startAngle + angle) * Math.PI) / 180;
              
              const x1 = 50 + 40 * Math.cos(startRad);
              const y1 = 50 + 40 * Math.sin(startRad);
              const x2 = 50 + 40 * Math.cos(endRad);
              const y2 = 50 + 40 * Math.sin(endRad);
              
              const color = item.color || colors[index % colors.length];
              
              return (
                <path
                  key={item.label}
                  d={`M 50 50 L ${x1} ${y1} A 40 40 0 ${largeArcFlag} 1 ${x2} ${y2} Z`}
                  fill={color}
                  className="transition-all duration-500"
                  style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.1))" }}
                />
              );
            })}
            <circle cx="50" cy="50" r="20" fill="hsl(var(--background))" />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-lg font-bold text-foreground">{total}</span>
          </div>
        </div>
        <div className="flex flex-wrap justify-center gap-3 mt-4">
          {data.map((item, index) => (
            <div key={item.label} className="flex items-center gap-1.5">
              <div 
                className="w-3 h-3 rounded-sm" 
                style={{ backgroundColor: item.color || colors[index % colors.length] }}
              />
              <span className="text-xs text-muted-foreground">{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (type === "line") {
    const points = data.map((item, index) => {
      const x = (index / (data.length - 1)) * 100;
      const y = 100 - (item.value / maxValue) * 80;
      return `${x},${y}`;
    }).join(" ");

    return (
      <div className="w-full" data-testid="chart-line">
        {title && <h3 className="text-sm font-semibold text-foreground mb-4">{title}</h3>}
        <svg viewBox="0 0 100 100" className="w-full" style={{ height }} preserveAspectRatio="none">
          <defs>
            <linearGradient id="lineGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#D7BB7D" stopOpacity="0.3"/>
              <stop offset="100%" stopColor="#D7BB7D" stopOpacity="0"/>
            </linearGradient>
          </defs>
          {[0, 25, 50, 75, 100].map((y) => (
            <line 
              key={y} 
              x1="0" 
              y1={100 - (y / 100) * 80} 
              x2="100" 
              y2={100 - (y / 100) * 80}
              stroke="hsl(var(--border))"
              strokeWidth="0.5"
              strokeDasharray="2,2"
            />
          ))}
          <polygon
            points={`0,100 ${points} 100,100`}
            fill="url(#lineGradient)"
          />
          <polyline
            points={points}
            fill="none"
            stroke="#D7BB7D"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {data.map((item, index) => {
            const x = (index / (data.length - 1)) * 100;
            const y = 100 - (item.value / maxValue) * 80;
            return (
              <circle
                key={item.label}
                cx={x}
                cy={y}
                r="3"
                fill="#001D34"
                stroke="#D7BB7D"
                strokeWidth="1.5"
              />
            );
          })}
        </svg>
        <div className="flex justify-between mt-2">
          {data.map((item) => (
            <span key={item.label} className="text-xs text-muted-foreground">
              {item.label}
            </span>
          ))}
        </div>
      </div>
    );
  }

  return null;
}
