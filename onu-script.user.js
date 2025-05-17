// ==UserScript==
// @name         Copiar dados ONU - Luiz Toledo
// @namespace    http://tampermonkey.net/
// @version      2.0
// @description  Copia Informações + Status GPON
// @author       Luiz Toledo
// @match        https://autoisp.gegnet.com.br/contracted_services/*
// @match        https://autoisp.gegnet.com.br/gpon_clients/*
// @updateURL    https://raw.githubusercontent.com/devluiztoledo/copiar-dados-onu-autoisp/main/onu-script.user.js
// @downloadURL  https://raw.githubusercontent.com/devluiztoledo/copiar-dados-onu-autoisp/main/onu-script.user.js
// @grant        GM_setClipboard
// ==/UserScript==

(function() {
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

  function criarBotaoCopiar(texto) {
    let btn = document.getElementById('btn-copiar-onu');
    if (!btn) {
      btn = document.createElement('button');
      btn.id = 'btn-copiar-onu';
      btn.textContent = '📋 Copiar Dados ONU';
      btn.className = 'btn btn-success';
      btn.style.margin = '5px';

      const container = document.querySelector('.general-buttons-wrapper.card-body');
      if (container) container.appendChild(btn);
      else {
        btn.style.cssText = 'position:fixed;top:50px;right:10px;z-index:9999';
        document.body.appendChild(btn);
      }
    }

    btn.onclick = () => {
      const copy = txt => navigator.clipboard
        ? navigator.clipboard.writeText(txt)
        : alert('Navegador não suporta cópia automática.');

      copy(btn.dataset.texto);
      alert('Dados copiados para a área de transferência!');
    };

    btn.dataset.texto = texto;
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

    const serial = document.querySelector('span.w-100.text-end[style*="font-size: 14pt"]')?.textContent.trim() || '';

    const statusLinhas = [...document.querySelectorAll('b.subtitle-card')]
      .find(b => b.textContent.includes('Diagnóstico GPON'))
      ?.nextElementSibling.querySelectorAll('table.borderless-table tbody tr') || [];

    const dados = {};
    const campos = ["Modelo de ONU","Firmware da ONU","Atenuação Rx ONU","Atenuação Rx OLT","Uptime da ONU"];
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

    const servicePort = [...document.querySelectorAll('td.text-start > div')]
      .find(div => /^\d+$/.test(div.textContent.trim()))
      ?.textContent.trim() || '';

    const rxOnu = dados["Atenuação Rx ONU"] || '';
    const status = /\d/.test(rxOnu) ? 'UP' : 'DOWN';

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

    criarBotaoCopiar(linhas.join('\n'));
  }

  window.addEventListener('load', () => setTimeout(copiarDadosONU, 2000));
})();
