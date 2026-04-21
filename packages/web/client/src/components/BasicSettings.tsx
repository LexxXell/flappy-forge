import { useI18n } from '../i18n'
import type { Manifest } from '../types'

interface Props {
  manifest: Manifest
  onChange: (m: Manifest) => void
}

export default function BasicSettings({ manifest, onChange }: Props) {
  const { t } = useI18n()

  function set(updater: (m: Manifest) => Manifest) {
    onChange(updater(manifest))
  }
  function setPhysics(key: keyof Manifest['physics'], val: number) {
    set(m => ({ ...m, physics: { ...m.physics, [key]: val } }))
  }
  function setSpawn(key: keyof Manifest['spawn'], val: number) {
    set(m => ({ ...m, spawn: { ...m.spawn, [key]: val } }))
  }
  function setCanvas(key: string, val: unknown) {
    set(m => ({ ...m, canvas: { ...m.canvas, [key]: val } }))
  }
  function setMeta(key: keyof Manifest['meta'], val: string) {
    set(m => ({ ...m, meta: { ...m.meta, [key]: val } }))
  }
  function setMenuText(key: 'start' | 'mute' | 'leaderboard', val: string) {
    set(m => ({ ...m, menu: { ...m.menu, [key]: { ...(m.menu?.[key] ?? {}), text: val } } }))
  }
  function setGameOver(key: keyof NonNullable<Manifest['gameOver']>, val: string) {
    set(m => ({ ...m, gameOver: { ...m.gameOver, [key]: val } }))
  }
  function setDifficulty(key: keyof NonNullable<Manifest['difficulty']>, val: number) {
    set(m => ({ ...m, difficulty: { ...m.difficulty, [key]: val } }))
  }

  const c = manifest.canvas ?? {}
  const d = manifest.difficulty ?? {}

  return (
    <div className="form-scroll">

      {/* Meta */}
      <div className="form-section">
        <div className="form-section-title">{t('settings.section.meta')}</div>
        <div className="form-row">
          <div className="form-field">
            <label>{t('settings.meta.id')}</label>
            <input type="text" value={manifest.meta.id} readOnly style={{ opacity: 0.6, cursor: 'not-allowed' }} />
          </div>
          <div className="form-field">
            <label>{t('settings.meta.title')}</label>
            <input type="text" value={manifest.meta.title} onChange={e => setMeta('title', e.target.value)} />
          </div>
        </div>
      </div>

      {/* Canvas */}
      <div className="form-section">
        <div className="form-section-title">{t('settings.section.canvas')}</div>
        <div className="form-row">
          <div className="form-field">
            <label>{t('settings.canvas.width')}</label>
            <input type="number" min={240} max={1920}
              value={c.width ?? 540}
              onChange={e => setCanvas('width', parseInt(e.target.value) || 540)} />
          </div>
          <div className="form-field">
            <label>{t('settings.canvas.height')}</label>
            <input type="number" min={400} max={2160}
              value={c.height ?? 960}
              onChange={e => setCanvas('height', parseInt(e.target.value) || 960)} />
          </div>
        </div>
        <div className="form-row">
          <div className="form-field">
            <label>{t('settings.canvas.bg')}</label>
            <input type="color"
              value={typeof c.backgroundColor === 'string' ? c.backgroundColor : '#1e3c56'}
              onChange={e => setCanvas('backgroundColor', e.target.value)} />
          </div>
          <div className="form-field">
            <label>{t('settings.canvas.scale')}</label>
            <select
              value={c.scale?.mode ?? 'FIT'}
              onChange={e => setCanvas('scale', { ...(c.scale ?? { autoCenter: 'CENTER_BOTH', zoom: 1 }), mode: e.target.value })}
            >
              <option value="FIT">{t('settings.canvas.scale.fit')}</option>
              <option value="ENVELOP">{t('settings.canvas.scale.envelop')}</option>
              <option value="RESIZE">{t('settings.canvas.scale.resize')}</option>
              <option value="NONE">{t('settings.canvas.scale.none')}</option>
            </select>
          </div>
        </div>
      </div>

      {/* Physics */}
      <div className="form-section">
        <div className="form-section-title">{t('settings.section.physics')}</div>
        {([
          ['gravity', 'settings.physics.gravity', 200, 2000, 1] as const,
          ['jumpForce', 'settings.physics.jump', -800, -100, 1] as const,
          ['speed', 'settings.physics.speed', 50, 600, 1] as const,
        ]).map(([key, labelKey, min, max]) => (
          <div key={key} className="form-field" style={{ marginBottom: 10 }}>
            <label>{t(labelKey)}: {manifest.physics[key]}</label>
            <div className="range-row">
              <input type="range" min={min} max={max}
                value={manifest.physics[key]}
                onChange={e => setPhysics(key, parseInt(e.target.value))} />
              <input type="number" min={min} max={max}
                value={manifest.physics[key]}
                onChange={e => setPhysics(key, parseInt(e.target.value) || manifest.physics[key])} />
            </div>
          </div>
        ))}
      </div>

      {/* Spawn */}
      <div className="form-section">
        <div className="form-section-title">{t('settings.section.pipes')}</div>
        <div className="form-row">
          <div className="form-field">
            <label>{t('settings.spawn.interval')}</label>
            <input type="number" min={300} max={5000}
              value={manifest.spawn.interval}
              onChange={e => setSpawn('interval', parseInt(e.target.value) || 1800)} />
          </div>
          <div className="form-field">
            <label>{t('settings.spawn.gapMin')}</label>
            <input type="number" min={60} max={600}
              value={manifest.spawn.gapMin}
              onChange={e => setSpawn('gapMin', parseInt(e.target.value) || 140)} />
          </div>
          <div className="form-field">
            <label>{t('settings.spawn.gapMax')}</label>
            <input type="number" min={60} max={600}
              value={manifest.spawn.gapMax}
              onChange={e => setSpawn('gapMax', parseInt(e.target.value) || 220)} />
          </div>
        </div>
      </div>

      {/* Player */}
      <div className="form-section">
        <div className="form-section-title">{t('settings.section.player')}</div>
        <div className="form-row">
          <div className="form-field">
            <label>{t('settings.player.width')}</label>
            <input type="number" min={10} max={200}
              value={manifest.player.width}
              onChange={e => set(m => ({ ...m, player: { ...m.player, width: parseInt(e.target.value) || 44 } }))} />
          </div>
          <div className="form-field">
            <label>{t('settings.player.height')}</label>
            <input type="number" min={10} max={200}
              value={manifest.player.height}
              onChange={e => set(m => ({ ...m, player: { ...m.player, height: parseInt(e.target.value) || 32 } }))} />
          </div>
        </div>
      </div>

      {/* Menu */}
      <div className="form-section">
        <div className="form-section-title">{t('settings.section.menu')}</div>
        <div className="form-row">
          <div className="form-field">
            <label>{t('settings.menu.start')}</label>
            <input type="text" value={manifest.menu?.start?.text ?? 'START'}
              onChange={e => setMenuText('start', e.target.value)} />
          </div>
          <div className="form-field">
            <label>{t('settings.menu.mute')}</label>
            <input type="text" value={manifest.menu?.mute?.text ?? 'SOUND'}
              onChange={e => setMenuText('mute', e.target.value)} />
          </div>
        </div>
        <div className="form-row">
          <div className="form-field">
            <label>{t('settings.menu.leaderboard')}</label>
            <input type="text" value={manifest.menu?.leaderboard?.text ?? 'LEADERBOARD'}
              onChange={e => setMenuText('leaderboard', e.target.value)} />
          </div>
        </div>
      </div>

      {/* Game Over */}
      <div className="form-section">
        <div className="form-section-title">{t('settings.section.gameover')}</div>
        <div className="form-row">
          <div className="form-field">
            <label>{t('settings.gameover.title')}</label>
            <input type="text" value={manifest.gameOver?.title ?? 'GAME OVER'}
              onChange={e => setGameOver('title', e.target.value)} />
          </div>
          <div className="form-field">
            <label>{t('settings.gameover.retry')}</label>
            <input type="text"
              value={(manifest.gameOver?.retry as { text?: string } | undefined)?.text ?? 'TRY AGAIN'}
              onChange={e => set(m => ({ ...m, gameOver: { ...m.gameOver, retry: { ...(m.gameOver?.retry as object ?? {}), text: e.target.value } } }))} />
          </div>
        </div>
        <div className="form-row">
          <div className="form-field">
            <label>{t('settings.gameover.scoreLabel')}</label>
            <input type="text" value={manifest.gameOver?.scoreLabel ?? 'SCORE'}
              onChange={e => setGameOver('scoreLabel', e.target.value)} />
          </div>
          <div className="form-field">
            <label>{t('settings.gameover.bestLabel')}</label>
            <input type="text" value={manifest.gameOver?.bestLabel ?? 'BEST'}
              onChange={e => setGameOver('bestLabel', e.target.value)} />
          </div>
          <div className="form-field">
            <label>{t('settings.gameover.newBest')}</label>
            <input type="text" value={manifest.gameOver?.newBestLabel ?? 'NEW RECORD'}
              onChange={e => setGameOver('newBestLabel', e.target.value)} />
          </div>
        </div>
      </div>

      {/* Difficulty */}
      <div className="form-section">
        <div className="form-section-title">{t('settings.section.difficulty')}</div>
        <div className="form-row">
          <div className="form-field">
            <label>{t('settings.difficulty.intervalStep')}</label>
            <input type="number" min={0} value={d.intervalStep ?? ''} placeholder="20"
              onChange={e => setDifficulty('intervalStep', parseFloat(e.target.value) || 0)} />
          </div>
          <div className="form-field">
            <label>{t('settings.difficulty.minInterval')}</label>
            <input type="number" min={100} value={d.minInterval ?? ''} placeholder="800"
              onChange={e => setDifficulty('minInterval', parseInt(e.target.value) || 800)} />
          </div>
        </div>
        <div className="form-row">
          <div className="form-field">
            <label>{t('settings.difficulty.gapShrink')}</label>
            <input type="number" min={0} step={0.5} value={d.gapShrinkPerPoint ?? ''} placeholder="0"
              onChange={e => setDifficulty('gapShrinkPerPoint', parseFloat(e.target.value) || 0)} />
          </div>
          <div className="form-field">
            <label>{t('settings.difficulty.minGap')}</label>
            <input type="number" min={40} value={d.minGap ?? ''} placeholder="80"
              onChange={e => setDifficulty('minGap', parseInt(e.target.value) || 80)} />
          </div>
        </div>
      </div>

      {/* Leaderboard */}
      <div className="form-section">
        <div className="form-section-title">{t('settings.section.leaderboard')}</div>
        <div className="form-row">
          <div className="form-field">
            <label>{t('settings.leaderboard.name')}</label>
            <input type="text" value={manifest.leaderboard?.name ?? 'main'}
              onChange={e => set(m => ({ ...m, leaderboard: { name: e.target.value } }))} />
          </div>
        </div>
      </div>

    </div>
  )
}
