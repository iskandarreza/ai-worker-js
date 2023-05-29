import dynamic from 'next/dynamic'

export const DynamicReactJson = dynamic(import('react-json-view'), {
  ssr: false,
})
