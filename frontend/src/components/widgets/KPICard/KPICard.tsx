import { ReactNode } from 'react'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface KPICardProps {
  title: string
  value: string | number
  change?: number
  changeLabel?: string
  icon?: ReactNode
  iconBgColor?: string
  format?: 'number' | 'currency' | 'percentage'
  subValue?: string
  urgent?: boolean
}

export default function KPICard({
  title,
  value,
  change,
  changeLabel = '어제 대비',
  icon,
  iconBgColor = 'bg-primary-100',
  format = 'number',
  subValue,
  urgent = false,
}: KPICardProps) {
  const formatValue = (val: string | number) => {
    if (typeof val === 'string') return val

    switch (format) {
      case 'currency':
        return new Intl.NumberFormat('ko-KR', {
          style: 'currency',
          currency: 'KRW',
          maximumFractionDigits: 0,
        }).format(val)
      case 'percentage':
        return `${val}%`
      default:
        return new Intl.NumberFormat('ko-KR').format(val)
    }
  }

  const getTrendIcon = () => {
    if (change === undefined || change === 0) return <Minus size={16} className="text-gray-400" />
    return change > 0 ? (
      <TrendingUp size={16} className="text-green-500" />
    ) : (
      <TrendingDown size={16} className="text-red-500" />
    )
  }

  const getTrendColor = () => {
    if (change === undefined || change === 0) return 'text-gray-500'
    return change > 0 ? 'text-green-600' : 'text-red-600'
  }

  return (
    <div className={`bg-white rounded-xl p-5 border ${urgent ? 'border-red-200 bg-red-50' : 'border-gray-200'}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm text-gray-500 mb-1">{title}</p>
          <p className={`text-2xl font-bold ${urgent ? 'text-red-600' : 'text-gray-900'}`}>
            {formatValue(value)}
          </p>
          {subValue && <p className="text-sm text-gray-500 mt-1">{subValue}</p>}
        </div>
        {icon && (
          <div className={`${iconBgColor} p-3 rounded-lg`}>
            {icon}
          </div>
        )}
      </div>

      {change !== undefined && (
        <div className="flex items-center gap-1 mt-3">
          {getTrendIcon()}
          <span className={`text-sm font-medium ${getTrendColor()}`}>
            {change > 0 ? '+' : ''}{change}%
          </span>
          <span className="text-sm text-gray-500">{changeLabel}</span>
        </div>
      )}
    </div>
  )
}
