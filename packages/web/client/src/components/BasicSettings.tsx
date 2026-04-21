import type { Manifest } from '../types'

interface Props {
  manifest: Manifest
  onChange: (m: Manifest) => void
}

export default function BasicSettings({ manifest, onChange }: Props) {
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
    set(m => ({
      ...m,
      menu: {
        ...m.menu,
        [key]: { ...(m.menu?.[key] ?? {}), text: val },
      },
    }))
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
        <div className="form-section-title">Мета</div>
        <div className="form-row">
          <div className="form-field">
            <label>ID темы</label>
            <input type="text" value={manifest.meta.id} readOnly style={{ opacity: 0.6, cursor: 'not-allowed' }} />
          </div>
          <div className="form-field">
            <label>Название игры</label>
            <input
              type="text"
              value={manifest.meta.title}
              onChange={e => setMeta('title', e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Canvas */}
      <div className="form-section">
        <div className="form-section-title">Холст</div>
        <div className="form-row">
          <div className="form-field">
            <label>Ширина (px)</label>
            <input
              type="number"
              min={240} max={1920}
              value={c.width ?? 540}
              onChange={e => setCanvas('width', parseInt(e.target.value) || 540)}
            />
          </div>
          <div className="form-field">
            <label>Высота (px)</label>
            <input
              type="number"
              min={400} max={2160}
              value={c.height ?? 960}
              onChange={e => setCanvas('height', parseInt(e.target.value) || 960)}
            />
          </div>
        </div>
        <div className="form-row">
          <div className="form-field">
            <label>Цвет фона</label>
            <input
              type="color"
              value={typeof c.backgroundColor === 'string' ? c.backgroundColor : '#1e3c56'}
              onChange={e => setCanvas('backgroundColor', e.target.value)}
            />
          </div>
          <div className="form-field">
            <label>Масштаб</label>
            <select
              value={c.scale?.mode ?? 'FIT'}
              onChange={e => setCanvas('scale', { ...(c.scale ?? { autoCenter: 'CENTER_BOTH', zoom: 1 }), mode: e.target.value })}
            >
              <option value="FIT">FIT (вписать)</option>
              <option value="ENVELOP">ENVELOP (заполнить)</option>
              <option value="RESIZE">RESIZE</option>
              <option value="NONE">NONE</option>
            </select>
          </div>
        </div>
      </div>

      {/* Physics */}
      <div className="form-section">
        <div className="form-section-title">Физика</div>
        <div className="form-field" style={{ marginBottom: 10 }}>
          <label>Гравитация: {manifest.physics.gravity}</label>
          <div className="range-row">
            <input
              type="range" min={200} max={2000}
              value={manifest.physics.gravity}
              onChange={e => setPhysics('gravity', parseInt(e.target.value))}
            />
            <input
              type="number" min={200} max={2000}
              value={manifest.physics.gravity}
              onChange={e => setPhysics('gravity', parseInt(e.target.value) || 900)}
            />
          </div>
        </div>
        <div className="form-field" style={{ marginBottom: 10 }}>
          <label>Сила прыжка: {manifest.physics.jumpForce}</label>
          <div className="range-row">
            <input
              type="range" min={-800} max={-100}
              value={manifest.physics.jumpForce}
              onChange={e => setPhysics('jumpForce', parseInt(e.target.value))}
            />
            <input
              type="number" min={-800} max={-100}
              value={manifest.physics.jumpForce}
              onChange={e => setPhysics('jumpForce', parseInt(e.target.value) || -380)}
            />
          </div>
        </div>
        <div className="form-field">
          <label>Скорость труб: {manifest.physics.speed}</label>
          <div className="range-row">
            <input
              type="range" min={50} max={600}
              value={manifest.physics.speed}
              onChange={e => setPhysics('speed', parseInt(e.target.value))}
            />
            <input
              type="number" min={50} max={600}
              value={manifest.physics.speed}
              onChange={e => setPhysics('speed', parseInt(e.target.value) || 210)}
            />
          </div>
        </div>
      </div>

      {/* Spawn */}
      <div className="form-section">
        <div className="form-section-title">Трубы / препятствия</div>
        <div className="form-row">
          <div className="form-field">
            <label>Интервал (мс)</label>
            <input
              type="number" min={300} max={5000}
              value={manifest.spawn.interval}
              onChange={e => setSpawn('interval', parseInt(e.target.value) || 1800)}
            />
          </div>
          <div className="form-field">
            <label>Мин. зазор (px)</label>
            <input
              type="number" min={60} max={600}
              value={manifest.spawn.gapMin}
              onChange={e => setSpawn('gapMin', parseInt(e.target.value) || 140)}
            />
          </div>
          <div className="form-field">
            <label>Макс. зазор (px)</label>
            <input
              type="number" min={60} max={600}
              value={manifest.spawn.gapMax}
              onChange={e => setSpawn('gapMax', parseInt(e.target.value) || 220)}
            />
          </div>
        </div>
      </div>

      {/* Player */}
      <div className="form-section">
        <div className="form-section-title">Игрок</div>
        <div className="form-row">
          <div className="form-field">
            <label>Ширина спрайта (px)</label>
            <input
              type="number" min={10} max={200}
              value={manifest.player.width}
              onChange={e => set(m => ({ ...m, player: { ...m.player, width: parseInt(e.target.value) || 44 } }))}
            />
          </div>
          <div className="form-field">
            <label>Высота спрайта (px)</label>
            <input
              type="number" min={10} max={200}
              value={manifest.player.height}
              onChange={e => set(m => ({ ...m, player: { ...m.player, height: parseInt(e.target.value) || 32 } }))}
            />
          </div>
        </div>
      </div>

      {/* Menu */}
      <div className="form-section">
        <div className="form-section-title">Меню</div>
        <div className="form-row">
          <div className="form-field">
            <label>Кнопка «Старт»</label>
            <input
              type="text"
              value={manifest.menu?.start?.text ?? 'START'}
              onChange={e => setMenuText('start', e.target.value)}
            />
          </div>
          <div className="form-field">
            <label>Кнопка «Звук»</label>
            <input
              type="text"
              value={manifest.menu?.mute?.text ?? 'SOUND'}
              onChange={e => setMenuText('mute', e.target.value)}
            />
          </div>
        </div>
        <div className="form-row">
          <div className="form-field">
            <label>Кнопка «Таблица лидеров»</label>
            <input
              type="text"
              value={manifest.menu?.leaderboard?.text ?? 'LEADERBOARD'}
              onChange={e => setMenuText('leaderboard', e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Game Over */}
      <div className="form-section">
        <div className="form-section-title">Экран «Игра окончена»</div>
        <div className="form-row">
          <div className="form-field">
            <label>Заголовок</label>
            <input
              type="text"
              value={manifest.gameOver?.title ?? 'GAME OVER'}
              onChange={e => setGameOver('title', e.target.value)}
            />
          </div>
          <div className="form-field">
            <label>Кнопка повтора</label>
            <input
              type="text"
              value={(manifest.gameOver?.retry as { text?: string } | undefined)?.text ?? 'TRY AGAIN'}
              onChange={e => set(m => ({ ...m, gameOver: { ...m.gameOver, retry: { ...(m.gameOver?.retry as object ?? {}), text: e.target.value } } }))}
            />
          </div>
        </div>
        <div className="form-row">
          <div className="form-field">
            <label>Подпись очков</label>
            <input
              type="text"
              value={manifest.gameOver?.scoreLabel ?? 'SCORE'}
              onChange={e => setGameOver('scoreLabel', e.target.value)}
            />
          </div>
          <div className="form-field">
            <label>Подпись рекорда</label>
            <input
              type="text"
              value={manifest.gameOver?.bestLabel ?? 'BEST'}
              onChange={e => setGameOver('bestLabel', e.target.value)}
            />
          </div>
          <div className="form-field">
            <label>Новый рекорд</label>
            <input
              type="text"
              value={manifest.gameOver?.newBestLabel ?? 'NEW RECORD'}
              onChange={e => setGameOver('newBestLabel', e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Difficulty */}
      <div className="form-section">
        <div className="form-section-title">Сложность</div>
        <div className="form-row">
          <div className="form-field">
            <label>Шаг ускорения (очки)</label>
            <input
              type="number" min={0}
              value={d.intervalStep ?? ''}
              placeholder="20"
              onChange={e => setDifficulty('intervalStep', parseFloat(e.target.value) || 0)}
            />
          </div>
          <div className="form-field">
            <label>Мин. интервал (мс)</label>
            <input
              type="number" min={100}
              value={d.minInterval ?? ''}
              placeholder="800"
              onChange={e => setDifficulty('minInterval', parseInt(e.target.value) || 800)}
            />
          </div>
        </div>
        <div className="form-row">
          <div className="form-field">
            <label>Сужение зазора / очко</label>
            <input
              type="number" min={0} step={0.5}
              value={d.gapShrinkPerPoint ?? ''}
              placeholder="0"
              onChange={e => setDifficulty('gapShrinkPerPoint', parseFloat(e.target.value) || 0)}
            />
          </div>
          <div className="form-field">
            <label>Мин. зазор (px)</label>
            <input
              type="number" min={40}
              value={d.minGap ?? ''}
              placeholder="80"
              onChange={e => setDifficulty('minGap', parseInt(e.target.value) || 80)}
            />
          </div>
        </div>
      </div>

      {/* Leaderboard */}
      <div className="form-section">
        <div className="form-section-title">Таблица лидеров (Yandex)</div>
        <div className="form-row">
          <div className="form-field">
            <label>Имя лидерборда</label>
            <input
              type="text"
              value={manifest.leaderboard?.name ?? 'main'}
              onChange={e => set(m => ({ ...m, leaderboard: { name: e.target.value } }))}
            />
          </div>
        </div>
      </div>

    </div>
  )
}
