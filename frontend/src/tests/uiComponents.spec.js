import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'

import AppCard from '../components/common/AppCard.vue'
import AppLink from '../components/common/AppLink.vue'
import AppTextElement from '../components/common/AppTextElement.vue'
import AppLabel from '../components/common/AppLabel.vue'

describe('AppCard', () => {
  it('renders card with default classes', () => {
    const wrapper = mount(AppCard, {
      slots: { default: 'Card Content' },
    })
    expect(wrapper.classes()).toContain('card')
    expect(wrapper.classes()).toContain('border-0')
    expect(wrapper.classes()).toContain('shadow-sm')
  })

  it('renders with custom className', () => {
    const wrapper = mount(AppCard, {
      props: { className: 'my-custom-card' },
      slots: { default: 'Content' },
    })
    expect(wrapper.classes()).toContain('my-custom-card')
  })

  it('renders with variant class', () => {
    const wrapper = mount(AppCard, {
      props: { variant: 'flush' },
      slots: { default: 'Content' },
    })
    expect(wrapper.classes()).toContain('card--flush')
  })

  it('renders card-body with bodyClass', () => {
    const wrapper = mount(AppCard, {
      props: { bodyClass: 'custom-body' },
      slots: { default: 'Inner' },
    })
    const body = wrapper.find('.card-body')
    expect(body.exists()).toBe(true)
    expect(body.classes()).toContain('custom-body')
  })

  it('renders custom element via as prop', () => {
    const wrapper = mount(AppCard, {
      props: { as: 'section' },
      slots: { default: 'Section Content' },
    })
    expect(wrapper.element.tagName).toBe('SECTION')
  })
})

describe('AppLink', () => {
  it('renders anchor with href', () => {
    const wrapper = mount(AppLink, {
      props: { href: 'https://example.com' },
      slots: { default: 'Link Text' },
    })
    expect(wrapper.element.tagName).toBe('A')
    expect(wrapper.attributes('href')).toBe('https://example.com')
  })

  it('adds noreferrer for external links', () => {
    const wrapper = mount(AppLink, {
      props: { href: 'https://example.com', target: '_blank' },
      slots: { default: 'External' },
    })
    const rel = wrapper.attributes('rel')
    expect(rel).toContain('noreferrer')
    expect(rel).toContain('noopener')
  })

  it('applies underline class when specified', () => {
    const wrapper = mount(AppLink, {
      props: { href: '#', underline: true },
      slots: { default: 'Underlined' },
    })
    expect(wrapper.classes()).toContain('app-link--underline')
  })

  it('applies custom className', () => {
    const wrapper = mount(AppLink, {
      props: { href: '#', className: 'custom-link' },
      slots: { default: 'Link' },
    })
    expect(wrapper.classes()).toContain('custom-link')
  })
})

describe('AppTextElement', () => {
  it('renders as span by default', () => {
    const wrapper = mount(AppTextElement, {
      slots: { default: 'Text' },
    })
    expect(wrapper.element.tagName).toBe('SPAN')
  })

  it('renders as different element via as prop', () => {
    const wrapper = mount(AppTextElement, {
      props: { as: 'p' },
      slots: { default: 'Paragraph' },
    })
    expect(wrapper.element.tagName).toBe('P')
  })

  it('renders as heading', () => {
    const wrapper = mount(AppTextElement, {
      props: { as: 'h1' },
      slots: { default: 'Heading' },
    })
    expect(wrapper.element.tagName).toBe('H1')
  })

  it('applies variant class', () => {
    const wrapper = mount(AppTextElement, {
      props: { variant: 'title' },
      slots: { default: 'Title Text' },
    })
    expect(wrapper.classes()).toContain('app-text-element--title')
  })

  it('applies truncate class', () => {
    const wrapper = mount(AppTextElement, {
      props: { truncate: true },
      slots: { default: 'Truncated' },
    })
    expect(wrapper.classes()).toContain('app-text-element--truncate')
  })

  it('applies nowrap class', () => {
    const wrapper = mount(AppTextElement, {
      props: { nowrap: true },
      slots: { default: 'No Wrap' },
    })
    expect(wrapper.classes()).toContain('app-text-element--nowrap')
  })

  it('renders text from text prop', () => {
    const wrapper = mount(AppTextElement, {
      props: { text: 'Prop Text' },
    })
    expect(wrapper.text()).toBe('Prop Text')
  })

  it('renders text from slot', () => {
    const wrapper = mount(AppTextElement, {
      slots: { default: 'Slot Text' },
    })
    expect(wrapper.text()).toBe('Slot Text')
  })
})

describe('AppLabel', () => {
  it('renders as label with for attribute', () => {
    const wrapper = mount(AppLabel, {
      props: { for: 'input-id' },
      slots: { default: 'Label Text' },
    })
    expect(wrapper.element.tagName).toBe('LABEL')
    expect(wrapper.attributes('for')).toBe('input-id')
  })

  it('applies custom className', () => {
    const wrapper = mount(AppLabel, {
      props: { className: 'custom-label' },
      slots: { default: 'Label' },
    })
    expect(wrapper.classes()).toContain('custom-label')
  })

  it('renders text from slot', () => {
    const wrapper = mount(AppLabel, {
      slots: { default: 'Slot Label' },
    })
    expect(wrapper.text()).toBe('Slot Label')
  })
})
