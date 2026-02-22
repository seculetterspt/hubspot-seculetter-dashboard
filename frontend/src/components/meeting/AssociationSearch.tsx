import { useState, useRef } from 'react'
import { Search, Building2, Briefcase, User, Plus, Loader2 } from 'lucide-react'
import { api } from '../../services/api'

interface SearchResult {
  id: string
  name: string
  email?: string
}

interface Props {
  existingIds: Set<string>
  onAdd: (type: 'company' | 'contact' | 'deal', item: { id: string; name: string }) => void
}

export default function AssociationSearch({ existingIds, onAdd }: Props) {
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [results, setResults] = useState<{
    companies: SearchResult[]
    contacts: SearchResult[]
    deals: SearchResult[]
  }>({ companies: [], contacts: [], deals: [] })
  const [hasSearched, setHasSearched] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()

  const doSearch = async (q: string) => {
    if (q.length < 2) {
      setResults({ companies: [], contacts: [], deals: [] })
      setHasSearched(false)
      return
    }
    setSearching(true)
    setHasSearched(true)
    try {
      const res = await api.get(`/meetings/search?q=${encodeURIComponent(q)}`)
      setResults({
        companies: res.data.companies || [],
        contacts: res.data.contacts || [],
        deals: res.data.deals || [],
      })
    } catch {
      setResults({ companies: [], contacts: [], deals: [] })
    } finally {
      setSearching(false)
    }
  }

  const handleChange = (value: string) => {
    setQuery(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => doSearch(value), 400)
  }

  const handleAdd = (type: 'company' | 'contact' | 'deal', item: SearchResult) => {
    onAdd(type, { id: item.id, name: item.name })
  }

  const totalResults = results.companies.length + results.contacts.length + results.deals.length

  return (
    <div>
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') doSearch(query) }}
          placeholder="회사, 연락처, 거래 검색..."
          className="w-full pl-9 pr-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:border-primary-500 bg-white"
        />
        {searching && (
          <Loader2 size={16} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-gray-400" />
        )}
      </div>

      {hasSearched && !searching && (
        <div className="mt-2 max-h-60 overflow-y-auto space-y-1">
          {totalResults === 0 ? (
            <p className="text-sm text-gray-400 text-center py-3">검색 결과가 없습니다</p>
          ) : (
            <>
              {results.companies.map(c => (
                <ResultRow
                  key={`company-${c.id}`}
                  icon={<Building2 size={15} className="text-blue-600" />}
                  label="회사"
                  item={c}
                  type="company"
                  disabled={existingIds.has(c.id)}
                  onAdd={handleAdd}
                />
              ))}
              {results.contacts.map(c => (
                <ResultRow
                  key={`contact-${c.id}`}
                  icon={<User size={15} className="text-green-600" />}
                  label="연락처"
                  item={c}
                  type="contact"
                  disabled={existingIds.has(c.id)}
                  onAdd={handleAdd}
                />
              ))}
              {results.deals.map(d => (
                <ResultRow
                  key={`deal-${d.id}`}
                  icon={<Briefcase size={15} className="text-purple-600" />}
                  label="거래"
                  item={d}
                  type="deal"
                  disabled={existingIds.has(d.id)}
                  onAdd={handleAdd}
                />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}

function ResultRow({ icon, label, item, type, disabled, onAdd }: {
  icon: React.ReactNode
  label: string
  item: { id: string; name: string; email?: string }
  type: 'company' | 'contact' | 'deal'
  disabled: boolean
  onAdd: (type: 'company' | 'contact' | 'deal', item: { id: string; name: string }) => void
}) {
  return (
    <div className="flex items-center gap-2.5 px-3 py-2 bg-white rounded-lg border border-gray-200">
      {icon}
      <div className="flex-1 min-w-0">
        <span className="text-sm text-gray-900 truncate block">{item.name}</span>
        {item.email && <span className="text-xs text-gray-400 truncate block">{item.email}</span>}
      </div>
      <span className="text-[10px] text-gray-400 flex-shrink-0">{label}</span>
      {disabled ? (
        <span className="text-xs text-gray-400 flex-shrink-0">추가됨</span>
      ) : (
        <button
          onClick={() => onAdd(type, item)}
          className="p-1.5 rounded-lg bg-primary-50 text-primary-600 hover:bg-primary-100 flex-shrink-0"
        >
          <Plus size={14} />
        </button>
      )}
    </div>
  )
}
