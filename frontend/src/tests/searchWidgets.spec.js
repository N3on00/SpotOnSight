import { describe, expect, it, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'

import SpotSearchWidget from '../components/map/SpotSearchWidget.vue'
import LocationSearchWidget from '../components/map/LocationSearchWidget.vue'

function createSpotSearchWrapper(props = {}) {
  const defaultProps = {
    filters: {},
    activeLocationLabel: '',
    resultCount: 0,
    totalCount: 0,
    canReset: false,
    subscriptions: [],
    initialExpanded: true,
  }

  return mount(SpotSearchWidget, {
    props: { ...defaultProps, ...props },
  })
}

function createLocationSearchWrapper(props = {}) {
  const defaultProps = {
    query: '',
    busy: false,
    errorText: '',
    results: [],
    activeLocation: null,
  }

  return mount(LocationSearchWidget, {
    props: { ...defaultProps, ...props },
  })
}

describe('SpotSearchWidget - Widget Tests Only', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Reset Functionality', () => {
    it('emits reset event when reset button clicked', async () => {
      const onReset = vi.fn()
      const wrapper = createSpotSearchWrapper({ 
        canReset: true,
        onReset 
      })

      const resetButton = wrapper.find('button[aria-label="Reset spot filters"]')
      await resetButton.trigger('click')
      await nextTick()

      expect(onReset).toHaveBeenCalled()
    })
  })

  describe('Subscription Actions', () => {
    it('emits subscribe event when subscribe button clicked', async () => {
      const onSubscribe = vi.fn()
      const wrapper = createSpotSearchWrapper({ onSubscribe })

      const subscribeButton = wrapper.find('button[aria-label="Subscribe this filter"]')
      await subscribeButton.trigger('click')
      await nextTick()

      expect(onSubscribe).toHaveBeenCalled()
    })
  })

  describe('Collapsed State', () => {
    it('toggles expanded state when chevron button clicked', async () => {
      const wrapper = createSpotSearchWrapper({ initialExpanded: false })
      
      expect(wrapper.vm.isExpanded).toBe(false)
      
      const toggleButton = wrapper.find('button[aria-label="Show filters"]')
      await toggleButton.trigger('click')
      await nextTick()

      expect(wrapper.vm.isExpanded).toBe(true)
    })
  })

  describe('Result Count Display', () => {
    it('displays result count and total', async () => {
      const wrapper = createSpotSearchWrapper({ 
        resultCount: 5,
        totalCount: 100
      })
      await nextTick()

      const badge = wrapper.find('.badge-soft')
      expect(badge.text()).toBe('5 / 100')
    })
  })

  describe('Active Location Display', () => {
    it('shows active location badge when location label provided', async () => {
      const wrapper = createSpotSearchWrapper({ 
        activeLocationLabel: 'Zurich, Switzerland'
      })
      await nextTick()

      const locationBadge = wrapper.find('.map-active-location')
      expect(locationBadge.exists()).toBe(true)
      expect(locationBadge.text()).toContain('Zurich')
    })
  })
})

describe('LocationSearchWidget - Widget Tests Only', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Search Button Click', () => {
    it('emits search when search button clicked', async () => {
      const onSearch = vi.fn()
      const wrapper = createLocationSearchWrapper({ 
        onSearch 
      })

      const searchButton = wrapper.find('button[aria-label="Find place"]')
      await searchButton.trigger('click')
      await nextTick()

      expect(onSearch).toHaveBeenCalled()
    })
  })

  describe('Search Button State', () => {
    it('shows busy label when busy is true', async () => {
      const wrapper = createLocationSearchWrapper({ busy: true })
      await nextTick()

      const button = wrapper.find('button[aria-label="Searching..."]')
      expect(button.exists()).toBe(true)
    })
  })

  describe('Location Results Display', () => {
    it('displays results when results array has items', async () => {
      const results = [
        { id: 'loc-1', label: 'Zurich HB', type: 'station', lat: 47.3782, lon: 8.5403 },
        { id: 'loc-2', label: 'Zurich, Bahnhofstrasse', type: 'street', lat: 47.3769, lon: 8.5417 }
      ]
      const wrapper = createLocationSearchWrapper({ results })
      await nextTick()

      const resultButtons = wrapper.findAll('.map-location-result')
      expect(resultButtons.length).toBe(2)
      expect(resultButtons[0].text()).toContain('Zurich HB')
    })

    it('emits select when result clicked', async () => {
      const onSelect = vi.fn()
      const results = [
        { id: 'loc-1', label: 'Zurich HB', type: 'station', lat: 47.3782, lon: 8.5403 }
      ]
      const wrapper = createLocationSearchWrapper({ results, onSelect })

      const resultButton = wrapper.find('.map-location-result')
      await resultButton.trigger('click')
      await nextTick()

      expect(onSelect).toHaveBeenCalledWith(results[0])
    })
  })

  describe('Active Location', () => {
    it('displays active location badge when activeLocation set', async () => {
      const activeLocation = { id: 'loc-1', label: 'Zurich HB', lat: 47.3782, lon: 8.5403 }
      const wrapper = createLocationSearchWrapper({ activeLocation })
      await nextTick()

      const activeBadge = wrapper.find('.map-active-location')
      expect(activeBadge.exists()).toBe(true)
    })

    it('clear button is disabled when no activeLocation', async () => {
      const wrapper = createLocationSearchWrapper({ activeLocation: null })
      await nextTick()

      const clearButton = wrapper.find('button[aria-label="Clear place"]')
      expect(clearButton.attributes('disabled')).toBeDefined()
    })

    it('emits clear when clear button clicked', async () => {
      const onClear = vi.fn()
      const activeLocation = { id: 'loc-1', label: 'Zurich HB', lat: 47.3782, lon: 8.5403 }
      const wrapper = createLocationSearchWrapper({ activeLocation, onClear })

      const clearButton = wrapper.find('button[aria-label="Clear place"]')
      await clearButton.trigger('click')
      await nextTick()

      expect(onClear).toHaveBeenCalled()
    })
  })

  describe('Error Display', () => {
    it('displays error text when errorText provided', async () => {
      const wrapper = createLocationSearchWrapper({ errorText: 'Network error' })
      await nextTick()

      const errorDiv = wrapper.find('.text-danger')
      expect(errorDiv.exists()).toBe(true)
      expect(errorDiv.text()).toBe('Network error')
    })
  })

  describe('Widget Header', () => {
    it('displays widget title', async () => {
      const wrapper = createLocationSearchWrapper()
      await nextTick()

      const title = wrapper.find('h3')
      expect(title.text()).toBe('Find place or address')
    })
  })
})

describe('SpotSearchWidget - Widget Tests Only', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Widget State', () => {
    it('displays result count and total', async () => {
      const wrapper = createSpotSearchWrapper({ 
        resultCount: 5,
        totalCount: 100
      })
      await nextTick()

      const badge = wrapper.find('.badge-soft')
      expect(badge.text()).toBe('5 / 100')
    })

    it('shows active location badge when location label provided', async () => {
      const wrapper = createSpotSearchWrapper({ 
        activeLocationLabel: 'Zurich, Switzerland'
      })
      await nextTick()

      const locationBadge = wrapper.find('.map-active-location')
      expect(locationBadge.exists()).toBe(true)
      expect(locationBadge.text()).toContain('Zurich')
    })

    it('toggles expanded state when chevron button clicked', async () => {
      const wrapper = createSpotSearchWrapper({ initialExpanded: false })
      
      expect(wrapper.vm.isExpanded).toBe(false)
      
      const toggleButton = wrapper.find('button[aria-label="Show filters"]')
      await toggleButton.trigger('click')
      await nextTick()

      expect(wrapper.vm.isExpanded).toBe(true)
    })
  })

  describe('Button Actions - No Page Navigation', () => {
    it('emits reset event when reset button clicked', async () => {
      const onReset = vi.fn()
      const wrapper = createSpotSearchWrapper({ 
        canReset: true,
        onReset 
      })

      const resetButton = wrapper.find('button[aria-label="Reset spot filters"]')
      await resetButton.trigger('click')
      await nextTick()

      expect(onReset).toHaveBeenCalled()
    })

    it('emits subscribe event when subscribe button clicked', async () => {
      const onSubscribe = vi.fn()
      const wrapper = createSpotSearchWrapper({ onSubscribe })

      const subscribeButton = wrapper.find('button[aria-label="Subscribe this filter"]')
      await subscribeButton.trigger('click')
      await nextTick()

      expect(onSubscribe).toHaveBeenCalled()
    })
  })

  describe('Display Elements', () => {
    it('displays widget title', async () => {
      const wrapper = createSpotSearchWrapper()
      await nextTick()

      const title = wrapper.find('h3')
      expect(title.text()).toBe('Search spots')
    })

    it('displays filter description', async () => {
      const wrapper = createSpotSearchWrapper()
      await nextTick()

      const description = wrapper.find('p.text-secondary')
      expect(description.text()).toContain('Filter by text')
    })
  })
})

describe('LocationSearchWidget - Widget Tests Only', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Button Actions - No Page Navigation', () => {
    it('emits search when search button clicked', async () => {
      const onSearch = vi.fn()
      const wrapper = createLocationSearchWrapper({ onSearch })

      const searchButton = wrapper.find('button[aria-label="Find place"]')
      await searchButton.trigger('click')
      await nextTick()

      expect(onSearch).toHaveBeenCalled()
    })

    it('emits clear when clear button clicked', async () => {
      const onClear = vi.fn()
      const activeLocation = { id: 'loc-1', label: 'Zurich HB', lat: 47.3782, lon: 8.5403 }
      const wrapper = createLocationSearchWrapper({ activeLocation, onClear })

      const clearButton = wrapper.find('button[aria-label="Clear place"]')
      await clearButton.trigger('click')
      await nextTick()

      expect(onClear).toHaveBeenCalled()
    })

    it('emits select when result clicked', async () => {
      const onSelect = vi.fn()
      const results = [
        { id: 'loc-1', label: 'Zurich HB', type: 'station', lat: 47.3782, lon: 8.5403 }
      ]
      const wrapper = createLocationSearchWrapper({ results, onSelect })

      const resultButton = wrapper.find('.map-location-result')
      await resultButton.trigger('click')
      await nextTick()

      expect(onSelect).toHaveBeenCalledWith(results[0])
    })
  })

  describe('Display States', () => {
    it('shows busy label when busy is true', async () => {
      const wrapper = createLocationSearchWrapper({ busy: true })
      await nextTick()

      const button = wrapper.find('button[aria-label="Searching..."]')
      expect(button.exists()).toBe(true)
    })

    it('displays error text when errorText provided', async () => {
      const wrapper = createLocationSearchWrapper({ errorText: 'Network error' })
      await nextTick()

      const errorDiv = wrapper.find('.text-danger')
      expect(errorDiv.exists()).toBe(true)
      expect(errorDiv.text()).toBe('Network error')
    })

    it('displays active location badge when activeLocation set', async () => {
      const activeLocation = { id: 'loc-1', label: 'Zurich HB', lat: 47.3782, lon: 8.5403 }
      const wrapper = createLocationSearchWrapper({ activeLocation })
      await nextTick()

      const activeBadge = wrapper.find('.map-active-location')
      expect(activeBadge.exists()).toBe(true)
    })

    it('clear button is disabled when no activeLocation', async () => {
      const wrapper = createLocationSearchWrapper({ activeLocation: null })
      await nextTick()

      const clearButton = wrapper.find('button[aria-label="Clear place"]')
      expect(clearButton.attributes('disabled')).toBeDefined()
    })
  })

  describe('Results Display', () => {
    it('displays results when results array has items', async () => {
      const results = [
        { id: 'loc-1', label: 'Zurich HB', type: 'station', lat: 47.3782, lon: 8.5403 },
        { id: 'loc-2', label: 'Zurich, Bahnhofstrasse', type: 'street', lat: 47.3769, lon: 8.5417 }
      ]
      const wrapper = createLocationSearchWrapper({ results })
      await nextTick()

      const resultButtons = wrapper.findAll('.map-location-result')
      expect(resultButtons.length).toBe(2)
      expect(resultButtons[0].text()).toContain('Zurich HB')
    })
  })

  describe('Widget Header', () => {
    it('displays widget title', async () => {
      const wrapper = createLocationSearchWrapper()
      await nextTick()

      const title = wrapper.find('h3')
      expect(title.text()).toBe('Find place or address')
    })
  })
})