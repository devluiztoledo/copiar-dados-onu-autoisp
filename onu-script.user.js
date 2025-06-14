// ==UserScript==
// @name         A1 Copiar dados ONU - Luiz Toledo
// @namespace    http://tampermonkey.net/
// @version      4.0
// @description  Copia Informações + Status GPON
// @author       Luiz Toledo
// @match        https://autoisp.gegnet.com.br/contracted_services/*
// @match        https://autoisp.gegnet.com.br/gpon_clients/*
// @updateURL    https://raw.githubusercontent.com/devluiztoledo/copiar-dados-onu-autoisp/main/onu-script.user.js
// @downloadURL  https://raw.githubusercontent.com/devluiztoledo/copiar-dados-onu-autoisp/main/onu-script.user.js
// @icon         https://raw.githubusercontent.com/devluiztoledo/copiar-dados-onu-autoisp/main/icon.png
// @grant        GM_setClipboard
// ==/UserScript==

(function () {
    'use strict';

    let alertaDetectado = false;

    function obterTexto(td) {
        if (!td) return '';
        const input = td.querySelector('input');
        if (input) return input.value.trim();
        const div = td.querySelector('div');
        if (div) {
            const clone = div.cloneNode(true);
            clone.querySelectorAll('i').forEach(el => el.remove());
            return clone.textContent.trim();
        }
        return td.textContent.trim();
    }

    function criarBotao(id, texto, cor, aoClicar) {
        if (document.getElementById(id)) return;
        const btn = document.createElement('button');
        btn.id = id;
        btn.textContent = texto;
        btn.className = `btn btn-${cor}`;
        btn.style.margin = '5px';
        const container = document.querySelector('.general-buttons-wrapper.card-body');
        if (container) container.appendChild(btn);
        else {
            Object.assign(btn.style, {
                position: 'fixed',
                top: '50px',
                right: '10px',
                zIndex: '9999'
            });
            document.body.appendChild(btn);
        }
        btn.addEventListener('click', aoClicar);
    }

    function copiarDadosONU() {
        
        const info = [...document.querySelectorAll('table.w-100.borderless-table.table-stripline')]
            .find(t => /OLT/.test(t.innerText) && /ONU ID/.test(t.innerText));
        let descOLT = '', olt = '', pon = '', onuid = '';
        if (info) {
            info.querySelectorAll('tr').forEach(tr => {
                const th = tr.querySelector('th')?.textContent.trim();
                const td = tr.querySelector('td');
                const v = obterTexto(td);
                if (th === 'Descrição na OLT') descOLT = v;
                if (th === 'OLT') olt = v;
                if (th === 'PON Link') pon = v;
                if (th === 'ONU ID') onuid = v;
            });
        }

        
        let causaQueda = '';
        const thCausa = [...document.querySelectorAll('th')]
            .find(th => th.textContent.trim() === 'Causa da Última queda');
        if (thCausa) {
            causaQueda = obterTexto(thCausa.nextElementSibling);
        }

        const serial = document.querySelector('.w-100.text-end[style*="font-size: 14pt"]')
            ?.textContent.trim() || '';

        
        const statusTable = [...document.querySelectorAll('b.subtitle-card')]
            .find(b => b.textContent.includes('Diagnóstico GPON'))
            ?.nextElementSibling;
        const rows = statusTable
            ? statusTable.querySelectorAll('table.borderless-table tbody tr')
            : [];

        const dados = {};
        const campos = ["Modelo de ONU", "Firmware da ONU", "Atenuação Rx ONU", "Atenuação Rx OLT", "Uptime da ONU"];
        rows.forEach(tr => {
            const label = tr.querySelector('th')?.textContent.trim();
            let valor = obterTexto(tr.querySelector('td'));
            if (label === 'Firmware da ONU') {
                valor = valor.replace(/(valid|invalid),?\s?(not\s)?committed/gi, '').trim();
            }
            if (campos.includes(label)) dados[label] = valor;
        });

        
        const thAl = [...document.querySelectorAll('th')].find(th => th.textContent.trim() === 'Alarmes');
        const alarmes = thAl ? obterTexto(thAl.nextElementSibling) : '';

        const trVl = [...document.querySelectorAll('tr')]
            .find(tr => tr.querySelector('th')?.textContent.trim() === 'VLAN (do perfil)');
        const vlan = trVl ? obterTexto(trVl.querySelector('td')) : '';

        const trSp = [...document.querySelectorAll('tr')]
            .find(tr => tr.querySelector('th')?.textContent.trim() === 'Service Port');
        const servicePort = trSp ? obterTexto(trSp.querySelector('td')) : '';

        
        const rxOnu = dados["Atenuação Rx ONU"] || '';
        const isLoss = !/\d/.test(rxOnu) || /(loss|los|sem sinal|no signal)/i.test(rxOnu);
        const status = isLoss ? 'DOWN' : 'UP';

        
        const linhas = [
            '[DADOS DA ONU]',
            `Local: ${descOLT}`,
            `Link: ${olt} ${pon} ID ${onuid}`,
            `Service Port: ${servicePort}`,
            `VLAN: ${vlan}`,
            `Modelo: ${dados["Modelo de ONU"] || ''}`,
            `Serial: ${serial}`,
            `Firmware: ${dados["Firmware da ONU"] || ''}`,
            `Rx ONU: ${rxOnu} (${status})`,
            `Rx OLT: ${dados["Atenuação Rx OLT"] || ''}`,
            `Uptime: ${dados["Uptime da ONU"] || ''}`
        ];
        if (status === 'DOWN') linhas.push(`Alarmes: ${alarmes || 'Sem info'}`);

        criarBotao('btn-copiar-onu', '📋 Copiar Dados ONU', 'success', () => {
            const txt = linhas.join('\n');
            if (typeof GM_setClipboard !== 'undefined') GM_setClipboard(txt);
            else navigator.clipboard.writeText(txt);
            
        });

        
        if (isLoss) {
            const tabTools = document.querySelector('.tab-pane#tab-tools');
            let dataQueda = '–';
            let ultimoSinal = '–';

            if (tabTools) {
                tabTools.querySelectorAll('table').forEach(table => {
                    const headers = [...table.querySelectorAll('th')].map(th => th.textContent.trim());

                    if (headers.includes('Data') && headers.includes('ONU RX Anterior')) {
                        const primeiraLinha = table.querySelector('tbody tr');
                        if (primeiraLinha) {
                            const cells = primeiraLinha.querySelectorAll('td');
                            dataQueda = cells[0]?.textContent.trim() || '–';
                            const idxAnterior = headers.indexOf('ONU RX Anterior');
                            ultimoSinal = cells[idxAnterior]?.textContent.trim() || '–';
                        }
                    }
                });
            }

            const msgLoss = [
                '',
                '--- TESTES CSA / ROTEADOR / ONU ---',
                'Verificado ONU DOWN (LINK LOSS)',
                `Local: ${descOLT}`,
                `Link: ${olt} ${pon} ID ${onuid}`,
                `Service Port: ${servicePort}`,
                `VLAN: ${vlan}`,
                `Modelo da ONU: ${dados["Modelo de ONU"] || 'Não Disponível'}`,
                '',
                `Plano desconectado desde: ${dataQueda}`,
                `Motivo da desconexão: ${causaQueda}`,
                `Último sinal ONU: ${ultimoSinal}`,
                '',
                'Demais clientes da caixa estão UP',
                'Energia confirmada',
                'Equipamentos reiniciados sem sucesso',
                'Cabos verificados',
                '',
                '--- LOGÍSTICA / O.S. ---',
                'Cliente sem acesso, ONU DOWN com link loss.',
                'Encaminhar técnico.'
            ].join('\n');

            criarBotao('btn-onu-down', '🚨 Teste ONU LOSS', 'danger', () => {
                if (typeof GM_setClipboard !== 'undefined') GM_setClipboard(msgLoss);
                else navigator.clipboard.writeText(msgLoss);
                
            });
        }
    }

    function observarAlerta() {
        const obs = new MutationObserver((muts, o) => {
            for (const m of muts) {
                for (const n of m.addedNodes) {
                    if (n.nodeType !== 1) continue;
                    const el = n;
                    if (el.matches('div.alert-success.alert-dismissible.show') &&
                        el.textContent.includes('Status da ONU atualizado com sucesso')) {
                        alertaDetectado = true;
                        o.disconnect();
                        copiarDadosONU();
                        return;
                    }
                    if (el.matches('div.alert-danger.alert-dismissible.show') &&
                        el.textContent.includes('Erro ao atualizar status da ONU')) {
                        alertaDetectado = true;
                        o.disconnect();
                        copiarDadosONU();
                        return;
                    }
                }
            }
        });
        obs.observe(document.body, { childList: true, subtree: true });
        setTimeout(() => {
            if (!alertaDetectado) {
                obs.disconnect();
                copiarDadosONU();
            }
        }, 10000);
    }

    window.addEventListener('load', observarAlerta);
})();
