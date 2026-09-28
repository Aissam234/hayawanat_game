import './ConnectionStatus.css'
export default function ConnectionStatus({isConnected}:{isConnected:boolean}) {
  return <div role="status" className={'connection-badge '+(isConnected?'is-online':'is-offline')}><span className="connection-dot" aria-hidden="true"/><span>{isConnected?'متصل':'إعادة الاتصال…'}</span></div>
}
