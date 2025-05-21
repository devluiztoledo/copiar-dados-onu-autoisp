// ==UserScript==
// @name         A1 Copiar dados ONU - Luiz Toledo
// @namespace    http://tampermonkey.net/
// @version      3.3.0
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

  function obterTexto(td) {
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
    let btn = document.getElementById(id);
    if (!btn) {
      btn = document.createElement('button');
      btn.id = id;
      btn.textContent = texto;
      btn.className = `btn btn-${cor}`;
      btn.style.margin = '5px';
      const container = document.querySelector('.general-buttons-wrapper.card-body');
      if (container) container.appendChild(btn);
      else {
        btn.style.cssText = 'position:fixed;top:50px;right:10px;z-index:9999';
        document.body.appendChild(btn);
      }
    }
    btn.onclick = aoClicar;
  }

  function copiarDadosONU() {

    const info = [...document.querySelectorAll('table.w-100.borderless-table.table-stripline')]
      .find(t => /OLT/.test(t.innerText) && /ONU ID/.test(t.innerText));
    let descOLT = '', olt = '', pon = '', onuid = '';
    if (info) {
      info.querySelectorAll('tr').forEach(tr => {
        const th = tr.querySelector('th')?.textContent.trim();
        const td = tr.querySelector('td');
        if (th && td) {
          const v = obterTexto(td);
          if (th === 'Descrição na OLT') descOLT = v;
          if (th === 'OLT') olt = v;
          if (th === 'PON Link') pon = v;
          if (th === 'ONU ID') onuid = v;
        }
      });
    }


    const serial = document.querySelector('.w-100.text-end[style*="font-size: 14pt"]')?.textContent.trim() || '';


    const statusLinhas = [...document.querySelectorAll('b.subtitle-card')]
      .find(b => b.textContent.includes('Diagnóstico GPON'))
      ?.nextElementSibling.querySelectorAll('table.borderless-table tbody tr') || [];

    const dados = {};
    const campos = ["Modelo de ONU", "Firmware da ONU", "Atenuação Rx ONU", "Atenuação Rx OLT", "Uptime da ONU"];
    statusLinhas.forEach(tr => {
      const th = tr.querySelector('th')?.textContent.trim();
      let td = obterTexto(tr.querySelector('td'));
      if (th === 'Firmware da ONU') td = td.replace(/(valid|invalid),?\s?(not\s)?committed/gi, '').trim();
      if (campos.includes(th)) dados[th] = td;
    });

    const alarmes = [...document.querySelectorAll('th')]
      .find(th => th.textContent.trim() === 'Alarmes')
      ?.nextElementSibling && obterTexto(
        [...document.querySelectorAll('th')]
          .find(th => th.textContent.trim() === 'Alarmes')
          .nextElementSibling
      ) || '';

    const vlan = [...document.querySelectorAll('tr')]
      .find(tr => tr.querySelector('th')?.textContent.trim() === 'VLAN (do perfil)')
      ?.querySelector('td') && obterTexto(
        [...document.querySelectorAll('tr')]
          .find(tr => tr.querySelector('th')?.textContent.trim() === 'VLAN (do perfil)')
          .querySelector('td')
      ) || '';


    const spRow = [...document.querySelectorAll('tr')]
      .find(tr => tr.querySelector('th')?.textContent.trim() === 'Service Port');
    const servicePort = spRow
      ? obterTexto(spRow.querySelector('td'))
      : '';

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
      navigator.clipboard.writeText(linhas.join('\n'));
      alert('Dados copiados para a área de transferência!');
    });


    if (isLoss) {
      const msgLoss = [
        '',
        '-------------------TESTES REALIZADOS PELO CSA E INFORMAÇÕES ROTEADOR/ONU-------------',
        '',
        'Verificado ONU DOWN ( LINK LOSS )',
        `ONU está localizada em: ${descOLT}`,
        `Link: ${olt} ${pon} ID ${onuid}`,
        `Service Port: ${servicePort}`,
        `VLAN: ${vlan}`,
        `Modelo da ONU: ${dados["Modelo de ONU"] || 'Não Disponível'}`,
        '',
        'Plano desconectado desde:',
        'Motivo da desconexão: ',
        '',
        'Demais clientes da caixa estão UP',
        'Energia confirmada',
        'Equipamentos reiniciados, porém, sem sucesso.',
        'Cabos verificados.',
        '',
        '',
        '-------------------INFORMAÇÕES PARA LOGÍSTICA COLOCAR NA ORDEM DE SERVIÇO PARA O TÉCNICO EXECUTAR -------------------',
        'Cliente está sem acesso à internet, a ONU está Down com link loss.',
        'Favor encaminhar técnico verificar.'
      ].join('\n');

      criarBotao('btn-onu-down', '🚨 Teste ONU LOSS', 'danger', () => {
        navigator.clipboard.writeText(msgLoss);
        alert('Teste ONU Down copiado!');
      });
    }
  }


  function observarAlerta() {
    const observer = new MutationObserver((mutations, obs) => {
      for (const m of mutations) {
        for (const node of m.addedNodes) {
          if (node.nodeType === 1) {
            const el = /** @type {HTMLElement} */(node);
            if (
              el.matches('div.alert-success.alert-dismissible.show') &&
              el.textContent.includes('ONU: Status da ONU atualizado com sucesso')
            ) {
              obs.disconnect();
              copiarDadosONU();
              return;
            }
          }
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }


  window.addEventListener('load', observarAlerta);

})();
