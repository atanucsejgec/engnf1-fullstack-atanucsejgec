import { useCallback, useEffect, useState } from 'react'

// Loads data from the API and tracks loading / error state.
// "load" is re-run whenever one of the values in "deps" changes.
//   const { data, loading, error, reload } = useApi(() => api.get('/tickets'), [filters])
export function useApi(load, deps) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [reloadCount, setReloadCount] = useState(0)

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stableLoad = useCallback(load, deps)

  useEffect(() => {
    // "ignore" stops an old, slow response from overwriting a newer one
    let ignore = false
    setLoading(true)
    setError(null)
    stableLoad()
      .then((result) => !ignore && setData(result))
      .catch((err) => !ignore && setError(err))
      .finally(() => !ignore && setLoading(false))
    return () => {
      ignore = true
    }
  }, [stableLoad, reloadCount])

  const reload = useCallback(() => setReloadCount((n) => n + 1), [])
  return { data, setData, loading, error, reload }
}
