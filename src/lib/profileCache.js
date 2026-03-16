import { getProfilesByIds } from '../services/api'

const cache = new Map()

export async function getProfileMap(ids = []){
  const uniqueIds = Array.from(new Set(ids.filter(Boolean)))
  const toFetch = uniqueIds.filter(id => !cache.has(id))
  if(toFetch.length > 0){
    const profiles = await getProfilesByIds(toFetch)
    profiles.forEach(p => cache.set(p.id, p))
  }
  const result = {}
  uniqueIds.forEach(id => {
    if(cache.has(id)) result[id] = cache.get(id)
  })
  return result
}

export function getNameFromProfile(p){
  if(!p) return null
  return p.first_name ? `${p.first_name}${p.last_name ? ' ' + p.last_name : ''}` : null
}

export function getCachedProfile(id){
  return cache.get(id) || null
}
