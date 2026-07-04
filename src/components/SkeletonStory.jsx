import React from 'react';

export default function SkeletonStory() {
  return (
    <div style={{ paddingBottom: 50 }}>
      
      {/* --- Header Skeleton (Capa + Infos) --- */}
      <div style={{ 
          display: 'flex', gap: '30px', padding: '30px', 
          background: '#1f1f1f', borderRadius: '10px', 
          marginBottom: '40px', border: '1px solid #333', flexWrap: 'wrap' 
      }}>
        
        {/* Capa Falsa */}
        <div style={{ flex: '0 0 200px', display: 'flex', justifyContent: 'center' }}>
            <div className="skeleton" style={{ width: '200px', height: '300px', borderRadius: '5px' }}></div>
        </div>

        {/* Informações Falsas */}
        <div style={{ flex: 1, minWidth: '300px' }}>
            {/* Título */}
            <div className="skeleton" style={{ width: '80%', height: '3rem', marginBottom: '20px', borderRadius: '4px' }}></div>
            
            {/* Autor */}
            <div className="skeleton" style={{ width: '40%', height: '1.2rem', marginBottom: '20px', borderRadius: '4px' }}></div>

            {/* Estrelas */}
            <div className="skeleton" style={{ width: '30%', height: '1.5rem', marginBottom: '20px', borderRadius: '4px' }}></div>

            {/* Categorias */}
            <div style={{ display: 'flex', gap: 10, marginBottom: '20px' }}>
                <div className="skeleton" style={{ width: '60px', height: '25px', borderRadius: '4px' }}></div>
                <div className="skeleton" style={{ width: '80px', height: '25px', borderRadius: '4px' }}></div>
                <div className="skeleton" style={{ width: '70px', height: '25px', borderRadius: '4px' }}></div>
            </div>

            {/* Sinopse Box */}
            <div className="skeleton" style={{ width: '100%', height: '120px', marginBottom: '20px', borderRadius: '5px' }}></div>

            {/* Botões */}
            <div style={{ display: 'flex', gap: 10 }}>
                <div className="skeleton" style={{ width: '120px', height: '45px', borderRadius: '20px' }}></div>
                <div className="skeleton" style={{ width: '160px', height: '45px', borderRadius: '20px' }}></div>
            </div>
        </div>
      </div>

      {/* --- Lista de Capítulos Skeleton --- */}
      <div className="skeleton" style={{ width: '200px', height: '2rem', marginBottom: '20px', borderRadius: '4px' }}></div>

      <div className="stories-grid" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {/* Simula 5 capítulos carregando */}
          {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="skeleton" style={{ width: '100%', height: '70px', borderRadius: '5px' }}></div>
          ))}
      </div>

    </div>
  );
}