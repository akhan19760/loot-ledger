import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { LazyMotion, MotionConfig } from 'motion/react'
import './index.css'
import App from './App.tsx'
import { SmoothScroll } from './components/motion/smooth-scroll.tsx'
import { queryClient } from './lib/query-client.ts'

// Components use the slim <m.*> elements; their animation features arrive in a chunk of
// their own, so the page can render before motion's full feature set has loaded.
const motionFeatures = () => import('./lib/motion-features.ts').then((m) => m.default)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      {/* Honour the OS "reduce motion" setting everywhere */}
      <MotionConfig reducedMotion="user">
        <LazyMotion features={motionFeatures}>
          <SmoothScroll>
            <App />
          </SmoothScroll>
        </LazyMotion>
      </MotionConfig>
    </QueryClientProvider>
  </StrictMode>,
)
