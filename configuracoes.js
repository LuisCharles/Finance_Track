(() => {
    "use strict";

    const formLimite = document.getElementById("formLimite");
    const inputLimite = document.getElementById("inputLimite");
    const btnRemoverLimite = document.getElementById("btnRemoverLimite");
    const btnResetar = document.getElementById("btnResetarDados");

    // --- NOVOS ELEMENTOS DE BACKUP ---
    const btnExportar = document.getElementById('btnExportar');
    const btnImportar = document.getElementById('btnImportar');
    const inputFile = document.getElementById('inputFileBackup');

    function carregarDados() {
        const limiteAtual = window.obterLimite();
        if (limiteAtual > 0) {
            inputLimite.value = limiteAtual;
        }
    }

    // ==========================================================
    // SISTEMA DE BACKUP (EXPORTAR / IMPORTAR) - INTRODUZIDO
    // ==========================================================

    // 1. Lógica para EXPORTAR os dados (Gera arquivo .json)
    if (btnExportar) {
        btnExportar.addEventListener('click', () => {
            const dadosBackup = {
                contas: JSON.parse(localStorage.getItem('contas') || '[]'),
                ganhos: JSON.parse(localStorage.getItem('ganhos') || '[]'),
                objetivos: JSON.parse(localStorage.getItem('objetivos') || '[]'),
                configuracoes: JSON.parse(localStorage.getItem('configuracoes') || '{}'),
                data_backup: new Date().toISOString()
            };

            const blob = new Blob([JSON.stringify(dadosBackup, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `finance_track_backup_${new Date().toLocaleDateString().replace(/\//g, '-')}.json`;
            a.click();
            URL.revokeObjectURL(url);
        });
    }

    // 2. Lógica para IMPORTAR os dados (Lê arquivo .json)
    if (btnImportar && inputFile) {
        btnImportar.addEventListener('click', () => inputFile.click());

        inputFile.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const dados = JSON.parse(event.target.result);
                    
                    const confirmacao = confirm("Atenção: Isso irá substituir todos os dados atuais pelos dados deste arquivo. Deseja continuar?");
                    
                    if (confirmacao) {
                        localStorage.setItem('contas', JSON.stringify(dados.contas || []));
                        localStorage.setItem('ganhos', JSON.stringify(dados.ganhos || []));
                        localStorage.setItem('objetivos', JSON.stringify(dados.objetivos || []));
                        localStorage.setItem('configuracoes', JSON.stringify(dados.configuracoes || {}));
                        
                        alert("Backup restaurado com sucesso! O sistema será atualizado.");
                        window.location.reload();
                    }
                } catch (err) {
                    alert("Erro ao ler o arquivo de backup. Certifique-se de que é um arquivo .json válido gerado por este app.");
                }
            };
            reader.readAsText(file);
        });
    }

    // ==========================================================
    // LÓGICA ORIGINAL DE LIMITES E RESET - MANTIDA
    // ==========================================================

    if (formLimite) {
        formLimite.addEventListener("submit", (e) => {
            e.preventDefault();
            const limite = parseFloat(inputLimite.value);
            
            if (isNaN(limite) || limite <= 0) {
                alert("Por favor, insira um valor válido maior que zero para o limite.");
            } else {
                window.salvarLimite(limite);
                alert(`Orçamento de ${window.formatBRL(limite)} salvo com sucesso! Confira sua tela Home.`);
            }
        });
    }

    if (btnRemoverLimite) {
        btnRemoverLimite.addEventListener("click", () => {
            window.salvarLimite(0); 
            inputLimite.value = ""; 
            alert("Orçamento removido com sucesso! A barra não aparecerá mais na tela Home.");
        });
    }

    if (btnResetar) {
        btnResetar.addEventListener("click", () => {
            const confirmacao1 = confirm("⚠️ ATENÇÃO: Isso apagará TODAS as suas contas, ganhos, objetivos e investimentos.\n\nTem certeza absoluta?");
            if (confirmacao1) {
                const confirmacao2 = prompt("Para confirmar a exclusão, digite a palavra APAGAR abaixo:");
                if (confirmacao2 === "APAGAR") {
                    localStorage.clear(); 
                    alert("Todos os dados foram apagados. O sistema será reiniciado.");
                    window.location.href = "index.html"; 
                } else {
                    alert("Ação cancelada. A palavra digitada não confere.");
                }
            }
        });
    }

    document.addEventListener("DOMContentLoaded", carregarDados);
})();