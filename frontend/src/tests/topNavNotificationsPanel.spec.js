import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'

import TopNavNotificationsPanel from '../components/layouts/TopNavNotificationsPanel.vue'

describe('TopNavNotificationsPanel', () => {
  it('renders filter controls, category badges, and emits selection through callback', async () => {
    const onSelectCategory = vi.fn()
    const wrapper = mount(TopNavNotificationsPanel, {
      props: {
        entries: [
          {
            id: 1,
            createdAt: '2026-03-18T11:00:00.000Z',
            title: 'New follower',
            message: 'Taylor followed you.',
            category: 'social',
            details: '',
          },
        ],
        categoryOptions: [
          { key: 'all', label: 'All', count: 3 },
          { key: 'social', label: 'Social', count: 1 },
        ],
        activeCategory: 'all',
        categoryFor: (entry) => entry.category,
        isExpanded: () => false,
        hasDetails: () => false,
        messageFor: (entry) => entry.message,
        detailsFor: (entry) => entry.details,
        timestampFor: () => '11:00',
        onToggleExpanded: vi.fn(),
        onSelectCategory,
        onClear: vi.fn(),
      },
    })

    expect(wrapper.text()).toContain('All (3)')
    expect(wrapper.text()).toContain('Social (1)')
    expect(wrapper.text()).toContain('social')

    await wrapper.find('button[aria-label="Social (1)"]').trigger('click')
    expect(onSelectCategory).toHaveBeenCalledWith('social')
  })

  it('shows an empty-state message for a filtered category with no entries', () => {
    const wrapper = mount(TopNavNotificationsPanel, {
      props: {
        entries: [],
        categoryOptions: [
          { key: 'all', label: 'All', count: 5 },
          { key: 'map', label: 'Map', count: 0 },
        ],
        activeCategory: 'map',
        categoryFor: () => 'map',
        isExpanded: () => false,
        hasDetails: () => false,
        messageFor: () => '',
        detailsFor: () => '',
        timestampFor: () => '',
        onToggleExpanded: vi.fn(),
        onSelectCategory: vi.fn(),
        onClear: vi.fn(),
      },
    })

    expect(wrapper.text()).toContain('No notifications in this category yet.')
  })
})
