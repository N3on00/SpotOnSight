export function startCreateAt({ editorMode, detailsOpen, editorDraft, editorOpen, lat, lon }) {
  editorMode.value = 'create'
  detailsOpen.value = false
  Object.assign(editorDraft, {
    id: '',
    title: '',
    description: '',
    tags: [],
    lat,
    lon,
    images: [],
    visibility: 'public',
    invite_user_ids: [],
  })
  editorOpen.value = true
}

export function openEditorFromSpot({ editorMode, editorDraft, editorOpen, spot }) {
  if (!spot) return
  editorMode.value = 'edit'
  Object.assign(editorDraft, {
    id: spot.id || '',
    title: spot.title || '',
    description: spot.description || '',
    tags: [...(spot.tags || [])],
    lat: Number(spot.lat || 0),
    lon: Number(spot.lon || 0),
    images: [...(spot.images || [])],
    visibility: String(spot.visibility || 'public'),
    invite_user_ids: [...(spot.invite_user_ids || [])],
  })
  editorOpen.value = true
}

export function pickLocationFromEditor({ editorDraft, editorOpen, pickMode, notify, draft }) {
  Object.assign(editorDraft, {
    id: draft.id || '',
    title: draft.title || '',
    description: draft.description || '',
    tags: [...(draft.tags || [])],
    lat: Number(draft.lat || 0),
    lon: Number(draft.lon || 0),
    images: [...(draft.images || [])],
    visibility: String(draft.visibility || 'public'),
    invite_user_ids: [...(draft.invite_user_ids || [])],
  })

  editorOpen.value = false
  pickMode.value = true
  notify({
    level: 'info',
    title: 'Pick location',
    message: 'Click on the map to set a new location.',
  })
}
