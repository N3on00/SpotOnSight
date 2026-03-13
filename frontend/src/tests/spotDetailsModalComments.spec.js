import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'

import SpotDetailsModal from '../components/map/SpotDetailsModal.vue'

describe('SpotDetailsModal comments composer', () => {
  it('shows comment input when create handler is provided', async () => {
    const onCreateComment = vi.fn(async () => ({ id: 'c1' }))
    const onCommentDraftChange = vi.fn()

    const wrapper = mount(SpotDetailsModal, {
      props: {
        open: true,
        spot: { id: 's1', title: 'Spot', lat: 47, lon: 8, tags: [] },
        onClose: () => {},
        onToggleFavorite: () => {},
        onNotify: () => {},
        onCreateComment,
        onCommentDraftChange,
        commentDraft: '',
      },
      global: {
        stubs: {
          Teleport: true,
        },
      },
    })

    expect(wrapper.find('.comments-create').exists()).toBe(true)
  })
})
