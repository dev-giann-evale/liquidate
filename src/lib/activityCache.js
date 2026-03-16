import { getActivitiesByIds } from '../services/api'

const cache = new Map()

export async function getActivityMap(ids = []){
  const uniqueIds = Array.from(new Set(ids.filter(Boolean)))
  const toFetch = uniqueIds.filter(id => !cache.has(id))
  if(toFetch.length > 0){
    const activities = await getActivitiesByIds(toFetch)
    activities.forEach(a => cache.set(a.id, a))
  }
  const result = {}
  uniqueIds.forEach(id => {
    if(cache.has(id)) result[id] = cache.get(id)
  })
  return result
}

export function getCachedActivity(id){
  return cache.get(id) || null
}
