import { useMemo, useState } from 'react'
import './App.css'

type EventItem = {
  date: string
  month: string
  weekday: string
  type: string
  title: string
  description: string
  location: string
  organizer: string
  time: string
  color: 'red' | 'yellow'
}

const events: EventItem[] = [
  {
    date: '19',
    month: 'SEP',
    weekday: 'SÁB',
    type: 'CHARLA',
    title: 'Diseño de niveles: del papel a la experiencia',
    description: 'Técnicas prácticas para diseñar niveles memorables e iterar con playtests.',
    location: 'Lima, Perú',
    organizer: 'IGDA Perú',
    time: '7:00 p. m. – 9:00 p. m.',
    color: 'red',
  },
  {
    date: '26',
    month: 'SEP',
    weekday: 'SÁB',
    type: 'TALLER',
    title: 'Introducción a Godot Engine',
    description: 'Una sesión práctica para dar tus primeros pasos y crear un juego 2D.',
    location: 'Lima, Perú',
    organizer: 'Comunidad Godot Lima',
    time: '3:00 p. m. – 6:00 p. m.',
    color: 'yellow',
  },
  {
    date: '03',
    month: 'OCT',
    weekday: 'SÁB',
    type: 'MEETUP',
    title: 'DevLog: comparte tu proyecto',
    description: 'Encuentro para mostrar avances, recibir feedback y conectar con desarrolladores.',
    location: 'Lima, Perú',
    organizer: 'Indie Devs Perú',
    time: '5:00 p. m. – 8:00 p. m.',
    color: 'red',
  },
  {
    date: '10',
    month: 'OCT',
    weekday: 'SÁB',
    type: 'CHARLA',
    title: 'De artista a líder de equipo',
    description: 'Conversación sobre liderazgo, comunicación y procesos creativos en equipos de juego.',
    location: 'Lima, Perú',
    organizer: 'Women in Games Perú',
    time: '7:00 p. m. – 9:00 p. m.',
    color: 'yellow',
  },
]

const communities = [
  ['IGDA Perú', 'Desarrollo profesional y comunidad', 'people'],
  ['Game Jam Perú', 'Jams y retos creativos', 'gamepad'],
  ['Indie Devs Perú', 'Desarrolladores independientes', 'code'],
  ['Comunidad Godot Lima', 'Usuarios de Godot Engine', 'godot'],
  ['Women in Games Perú', 'Mujeres en la industria', 'people'],
]

function App() {
  const [filter, setFilter] = useState('Todos')
  const [notice, setNotice] = useState('')

  const visibleEvents = useMemo(() => {
    if (filter === 'Todos') return events
    if (filter === 'Lima') return events.filter((event) => event.location.includes(filter))
    return events.filter((event) => event.month === 'SEP')
  }, [filter])

  const handlePublish = () => {
    setNotice('La publicación de eventos estará disponible en el próximo módulo del MVP.')
  }

  return (
    <div className="app-shell">
      <header className="site-header">
        <a className="brand" href="/" aria-label="Agenda IGDA Perú, inicio">
          <span className="brand-mark" aria-hidden="true"><span /></span>
          <span className="brand-name">igda<small>Perú</small></span>
        </a>
        <nav className="main-nav" aria-label="Navegación principal">
          <a className="active" href="#agenda">Agenda</a>
          <a href="#comunidades">Comunidades</a>
        </nav>
        <button className="publish-button" type="button" onClick={handlePublish}>
          <span aria-hidden="true">+</span> Publicar evento
        </button>
      </header>

      <main>
        <section className="intro" id="agenda">
          <h1>Agenda IGDA Perú</h1>
          <p>Descubre eventos, meetups, charlas y talleres de la comunidad de desarrollo de videojuegos en Perú.</p>
        </section>

        {notice && <p className="notice" role="status">{notice}</p>}

        <div className="content-grid">
          <section className="events-section" aria-labelledby="upcoming-title">
            <h2 id="upcoming-title">Próximos eventos</h2>
            <div className="filters" aria-label="Filtrar eventos">
              {['Todos', 'Este mes', 'Lima'].map((item) => (
                <button
                  className={`filter-button ${filter === item ? 'selected' : ''}`}
                  key={item}
                  type="button"
                  onClick={() => setFilter(item)}
                  aria-pressed={filter === item}
                >
                  {item}{item === 'Este mes' && <span className="calendar-icon" aria-hidden="true" />}
                </button>
              ))}
            </div>

            <div className="event-list">
              {visibleEvents.map((event) => (
                <article className="event-row" key={event.title}>
                  <div className="event-date">
                    <span>{event.month}</span>
                    <strong>{event.date}</strong>
                    <small>{event.weekday}</small>
                  </div>
                  <div className={`event-accent ${event.color}`} />
                  <div className="event-details">
                    <span className={`event-type ${event.color}`}>{event.type}</span>
                    <h3>{event.title}</h3>
                    <p>{event.description}</p>
                    <div className="event-meta">
                      <span><span aria-hidden="true">⌖</span>{event.location}</span>
                      <span><span aria-hidden="true">♧</span>{event.organizer}</span>
                      <span><span aria-hidden="true">◷</span>{event.time}</span>
                    </div>
                  </div>
                  <span className="event-arrow" aria-hidden="true">›</span>
                </article>
              ))}
            </div>
          </section>

          <aside className="communities-panel" id="comunidades" aria-labelledby="communities-title">
            <h2 id="communities-title">Comunidades</h2>
            <p>Explora más eventos de comunidades de la industria y afines.</p>
            <div className="community-list">
              {communities.map(([name, description, icon]) => (
                <a className="community-item" href={`#${name.toLowerCase().replaceAll(' ', '-')}`} key={name}>
                  <span className={`community-icon ${icon}`} aria-hidden="true">{icon === 'code' ? '</>' : icon === 'gamepad' ? '⌁' : icon === 'godot' ? '✣' : '•••'}</span>
                  <span><strong>{name}</strong><small>{description}</small></span>
                  <span className="community-arrow" aria-hidden="true">›</span>
                </a>
              ))}
            </div>
            <a className="all-communities" href="#comunidades">Ver todas las comunidades <span aria-hidden="true">›</span></a>
            <footer>Impulsada por <strong>IGDA Perú</strong></footer>
          </aside>
        </div>
      </main>
    </div>
  )
}

export default App
