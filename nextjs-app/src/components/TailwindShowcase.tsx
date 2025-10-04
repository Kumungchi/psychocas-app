'use client'

import { useState } from 'react'

export default function TailwindShowcase() {
  const [activeTab, setActiveTab] = useState('colors')

  return (
    <div className="mt-16 max-w-6xl mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-gradient mb-4">
          🎨 Tailwind CSS Showcase
        </h2>
        <p className="text-gray-600">
          Ukázka našich vlastních Tailwind utility tříd a komponent
        </p>
      </div>

      {/* Tab navigace */}
      <div className="flex justify-center mb-8">
        <div className="glass rounded-lg p-1">
          <button
            onClick={() => setActiveTab('colors')}
            className={`px-4 py-2 rounded-md transition-all duration-200 ${
              activeTab === 'colors'
                ? 'bg-blue-500 text-white shadow-md'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Barvy
          </button>
          <button
            onClick={() => setActiveTab('effects')}
            className={`px-4 py-2 rounded-md transition-all duration-200 ${
              activeTab === 'effects'
                ? 'bg-blue-500 text-white shadow-md'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Efekty
          </button>
          <button
            onClick={() => setActiveTab('animations')}
            className={`px-4 py-2 rounded-md transition-all duration-200 ${
              activeTab === 'animations'
                ? 'bg-blue-500 text-white shadow-md'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Animace
          </button>
        </div>
      </div>

      {/* Obsah tabů */}
      {activeTab === 'colors' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 animate-fade-in">
          <div className="card gradient-primary text-white">
            <h3 className="font-semibold mb-2">Primary Gradient</h3>
            <p className="text-sm opacity-90">.gradient-primary</p>
          </div>
          <div className="card gradient-secondary text-white">
            <h3 className="font-semibold mb-2">Secondary Gradient</h3>
            <p className="text-sm opacity-90">.gradient-secondary</p>
          </div>
          <div className="card gradient-success text-white">
            <h3 className="font-semibold mb-2">Success Gradient</h3>
            <p className="text-sm opacity-90">.gradient-success</p>
          </div>
          <div className="card gradient-warm text-white">
            <h3 className="font-semibold mb-2">Warm Gradient</h3>
            <p className="text-sm opacity-90">.gradient-warm</p>
          </div>
        </div>
      )}

      {activeTab === 'effects' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-fade-in">
          <div className="card hover-lift">
            <h3 className="font-semibold mb-2">Hover Lift</h3>
            <p className="text-sm text-gray-600 mb-4">
              Najeďte myší pro efekt zvednutí
            </p>
            <code className="text-xs bg-gray-100 px-2 py-1 rounded">.hover-lift</code>
          </div>
          
          <div className="card hover-scale">
            <h3 className="font-semibold mb-2">Hover Scale</h3>
            <p className="text-sm text-gray-600 mb-4">
              Najeďte myší pro efekt zvětšení
            </p>
            <code className="text-xs bg-gray-100 px-2 py-1 rounded">.hover-scale</code>
          </div>
          
          <div className="card shadow-glow">
            <h3 className="font-semibold mb-2">Glow Shadow</h3>
            <p className="text-sm text-gray-600 mb-4">
              Světélkující stín kolem karty
            </p>
            <code className="text-xs bg-gray-100 px-2 py-1 rounded">.shadow-glow</code>
          </div>
        </div>
      )}

      {activeTab === 'animations' && (
        <div className="space-y-6 animate-fade-in">
          <div className="card">
            <h3 className="font-semibold mb-4">Text Animace</h3>
            <div className="space-y-4">
              <div>
                <h4 className="text-gradient text-xl font-bold">
                  Gradient Text
                </h4>
                <code className="text-xs bg-gray-100 px-2 py-1 rounded">.text-gradient</code>
              </div>
              
              <div>
                <h4 className="text-shimmer text-xl font-bold">
                  Shimmer Effect
                </h4>
                <code className="text-xs bg-gray-100 px-2 py-1 rounded">.text-shimmer</code>
              </div>
            </div>
          </div>
          
          <div className="card animated-gradient text-white">
            <h3 className="font-semibold mb-2">Animated Background</h3>
            <p className="text-sm opacity-90 mb-4">
              Animované pozadí s postupně se měnícími barvami
            </p>
            <code className="text-xs bg-white bg-opacity-20 px-2 py-1 rounded">
              .animated-gradient
            </code>
          </div>
          
          <div className="flex space-x-4">
            <div className="flex-1 card pulse-slow">
              <h3 className="font-semibold mb-2">Slow Pulse</h3>
              <p className="text-sm text-gray-600">.pulse-slow</p>
            </div>
            
            <div className="flex-1">
              <div className="skeleton h-20 rounded-lg"></div>
              <p className="text-center mt-2 text-sm text-gray-600">
                <code>.skeleton</code> loading efekt
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="mt-12 card text-center">
        <h3 className="text-lg font-semibold mb-4">
          💡 Jak používat tyto styly
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
          <div>
            <h4 className="font-medium mb-2">V HTML/JSX:</h4>
            <code className="text-xs bg-gray-100 p-3 rounded block">
              {`<div className="card hover-lift gradient-primary">
  Content
</div>`}
            </code>
          </div>
          <div>
            <h4 className="font-medium mb-2">Vlastní komponenty:</h4>
            <code className="text-xs bg-gray-100 p-3 rounded block">
              {`<div className="btn-primary">
  Button
</div>`}
            </code>
          </div>
        </div>
      </div>
    </div>
  )
}