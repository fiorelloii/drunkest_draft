// app.js

const NUM_SQUADRE = 10;
const NUM_TURNI = 13;
const TEMP_FILE_KEY = "fantabasket_draft_temp"; // Using localStorage for temp save

class DraftApp {

    // Aggiorna il pannello del giocatore selezionato
    updateSelectedPlayerPanel() {
        const panel = document.getElementById('selected-player-panel');
        if (!panel) return;
        const nome = this.playerEntry.value.trim();
        let player = null;
        if (nome) {
            player = this.giocatoriDisponibili.find(([n]) => n.toLowerCase() === nome.toLowerCase());
            if (!player) {
                player = (this.listaGiocatoriOriginale || []).find(([n]) => n.toLowerCase() === nome.toLowerCase());
            }
        }
        let n, ruolo, squadra, imgUrl;
        if (player) {
            [n, ruolo, squadra, imgUrl] = player;
        } else {
            n = 'Giocatore';
            ruolo = 'Ruolo';
            squadra = 'Squadra';
            imgUrl = '';
        }
        panel.innerHTML = `
            <div class="selected-player-frame">
                <div class="selected-player-img-wrap">
                    ${imgUrl ? `<img src="${imgUrl}" alt="${n}" class="selected-player-img" />` : ''}
                </div>
                <div class="selected-player-info">
                    <div class="selected-player-name">${n}</div>
                    <div class="selected-player-ruolo">${ruolo || ''}</div>
                    <div class="selected-player-squadra">${squadra || ''}</div>
                </div>
            </div>
        `;
    }

    /**
     * Salva lo stato attuale del draft in un file JSON scaricabile.
     * Il file risultante può essere ricaricato tramite loadDraft.
     */
    saveDraft() {
        const data = {
            rose: this.rose,
            contatoriRuoli: this.contatoriRuoli,
            giocatoriDisponibili: this.giocatoriDisponibili,
            draftSequence: this.draftSequence,
            pickData: this.pickData,
            pickIndex: this.pickIndex,
            listaGiocatoriOriginale: this.listaGiocatoriOriginale,
            teams: this.teams
        };
        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `draft_fantabasket_${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        this.showStatus("Draft salvato correttamente.", true);
    }
    // Popola la lista di tutti i giocatori disponibili nella sezione ricerca
    updateAllPlayersList(filter = '') {
        const container = document.getElementById('all-players-list');
        if (!container) return;
        container.innerHTML = '';
        let players = this.giocatoriDisponibili;
        if (filter && filter.length > 0) {
            players = players.filter(([nome, ruolo, squadra]) => nome.toLowerCase().includes(filter.toLowerCase()));
        }
        if (!players || players.length === 0) {
            container.innerHTML = '<div class="empty-list">Nessun giocatore trovato.</div>';
            return;
        }
        const ul = document.createElement('ul');
        ul.className = 'all-players-ul';
        players.forEach(([nome, ruolo, squadra, imgUrl]) => {
            const li = document.createElement('li');
            li.className = 'all-players-li player-slot';
            li.tabIndex = 0;
            li.style.cursor = 'pointer';

            // Struttura identica a quella delle tripletta
            // Immagine giocatore (se presente)
            if (imgUrl) {
                const img = document.createElement('img');
                img.src = imgUrl;
                img.alt = nome;
                img.className = 'player-slot-img';
                li.appendChild(img);
            }

            // Nome giocatore
            const nameDiv = document.createElement('div');
            nameDiv.className = 'player-slot-name';
            nameDiv.textContent = nome;
            li.appendChild(nameDiv);

            // Ruolo
            const ruoloDiv = document.createElement('div');
            ruoloDiv.className = 'player-slot-ruolo';
            ruoloDiv.textContent = ruolo || '';
            li.appendChild(ruoloDiv);

            // Squadra in piccolo
            const teamDiv = document.createElement('div');
            teamDiv.className = 'player-team-label';
            teamDiv.textContent = squadra ? squadra : '';
            li.appendChild(teamDiv);

            li.addEventListener('click', () => {
                this.playerEntry.value = nome;
                this.updateSelectedPlayerPanel();
                const squadraDest = this.draftSequence[this.pickInModifica !== null ? this.pickInModifica : this.pickIndex];
                this.assegnaGiocatore();
                this.updateAllPlayersList(this.playerEntry.value);
                setTimeout(() => {
                    const frame = document.getElementById(`roster-${squadraDest.replace(/\s/g, '-')}`);
                    if (frame && frame.scrollIntoView) {
                        frame.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
                    }
                }, 100);
            });
            li.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    this.playerEntry.value = nome;
                    this.updateSelectedPlayerPanel();
                    const squadraDest = this.draftSequence[this.pickInModifica !== null ? this.pickInModifica : this.pickIndex];
                    this.assegnaGiocatore();
                    this.updateAllPlayersList(this.playerEntry.value);
                    setTimeout(() => {
                        const frame = document.getElementById(`roster-${squadraDest.replace(/\s/g, '-')}`);
                        if (frame && frame.scrollIntoView) {
                            frame.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
                        }
                    }, 100);
                }
            });
            ul.appendChild(li);
        });
        container.appendChild(ul);
    }
    constructor() {
        this.undoStack = [];
        this.redoStack = [];
        this.teams = [];
        this.giocatoriDisponibili = [];
        this.listaGiocatoriOriginale = [];
        this.rose = {};
        this.contatoriRuoli = {};
        this.draftSequence = [];
        this.pickData = [];
        this.pickIndex = 0;
        this.pickInModifica = null;
    this.lastAdded = { team: null, ruolo: null };

        this.setupDOMReferences();
        this.setupEventListeners();
        this.setupTeamInputFields();
        this.askLoadTemp();
        this.showStatus("----- Avvio completato -----", false);
        // Mostra il frame vuoto all'avvio
        this.updateSelectedPlayerPanel();
    }

    // --- DOM Setup & Event Listeners ---

    setupDOMReferences() {
        this.statusText = document.getElementById('status-text');
        this.teamEntriesContainer = document.getElementById('team-entries-container');
        this.pickLabel = document.getElementById('pick-label');
        this.playerEntry = document.getElementById('player-entry');
        this.playerSuggestions = document.getElementById('player-suggestions');
        this.pickListContainer = document.getElementById('pick-listbox-container');
        this.roseContainer = document.getElementById('rose-container');
        this.tabButtons = document.querySelectorAll('.tab-button');
        this.tabContents = document.querySelectorAll('.tab-content');
    }

    setupEventListeners() {
        this.tabButtons.forEach(button => {
            button.addEventListener('click', () => this.switchTab(button));
        });
        document.addEventListener('keydown', (e) => this.handleGlobalKeydown(e));
        this.playerEntry.addEventListener('input', () => {
            this.updateAllPlayersList(this.playerEntry.value);
            this.autocomplete();
            this.updateSelectedPlayerPanel();
        });
        // Right-click listener for picklist (simplified context menu)
        this.pickListContainer.addEventListener('contextmenu', (e) => this.showPickContextMenu(e));
    }

    setupTeamInputFields() {
        for (let i = 0; i < NUM_SQUADRE; i++) {
            const div = document.createElement('div');
            const label = document.createElement('label');
            label.textContent = `${i + 1}.`;
            const input = document.createElement('input');
            input.type = 'text';
            input.id = `team-entry-${i}`;
            div.appendChild(label);
            div.appendChild(input);
            this.teamEntriesContainer.appendChild(div);
        }
    }

    switchTab(button) {
        this.tabButtons.forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');

        this.tabContents.forEach(content => content.classList.remove('active'));
        document.getElementById(button.dataset.tab).classList.add('active');
    }

    handleGlobalKeydown(e) {
        // Handle Ctrl+Z (Undo) and Ctrl+Y (Redo)
        if (e.ctrlKey && e.key === 'z') {
            e.preventDefault();
            this.undo();
        } else if (e.ctrlKey && e.key === 'y') {
            e.preventDefault();
            this.redo();
        } else if (e.key === 'Enter' && e.target.id === 'player-entry') {
            // Prevent form submission or unwanted behavior
            e.preventDefault();
            this.assegnaGiocatore();
        }
    }

    // --- Utility & Status ---

    showStatus(message, temporary = false, duration = 3000) {
        console.log(`STATUS: ${message}`);
        this.statusText.textContent = message;

        if (this._statusTimeout) {
            clearTimeout(this._statusTimeout);
        }
        if (temporary) {
            this._statusTimeout = setTimeout(() => this.statusText.textContent = "", duration);
        }
    }

    // --- Core Logic Porting (Simplified) ---

    generaDraftSequence(teams, numTurni) {
        const draftOrder = [];
        for (let turno = 0; turno < numTurni; turno++) {
            const roundTeams = [...teams]; // Shallow copy
            if (turno % 2 !== 0) {
                roundTeams.reverse(); // Snake draft
            }
            draftOrder.push(...roundTeams);
        }
        return draftOrder;
    }

    inizializzaRoseEContatori(teams) {
        const rose = {};
        const contatori = {};
        teams.forEach(team => {
            rose[team] = [];
            contatori[team] = { "G": 0, "A": 0, "C": 0 };
        });
        return { rose, contatori };
    }

    /**
     * Crea placeholder per la decima squadra (se presente) e aggiorna contatori.
     * Inserisce 5 guardie (G), 5 ali (A) e 3 centri (C) direttamente in `this.rose`.
     * I placeholder non vengono aggiunti a `giocatoriDisponibili`.
     */
    creaPlaceholdersPerDecimaSquadra() {
        const NON_PICKING_INDEX = NUM_SQUADRE - 1; // 9
        if (!this.teams || this.teams.length <= NON_PICKING_INDEX) return;
        const team = this.teams[NON_PICKING_INDEX];
        if (!team) return;

        // Ensure structures exist
        if (!this.rose) this.rose = {};
        if (!this.contatoriRuoli) this.contatoriRuoli = {};

        // Initialize if necessary
        if (!this.rose[team]) this.rose[team] = [];
        if (!this.contatoriRuoli[team]) this.contatoriRuoli[team] = { "G": 0, "A": 0, "C": 0 };

        // Clear any existing entries and re-add placeholders
        this.rose[team] = [];
        const placeholders = [];
        for (let i = 1; i <= 5; i++) placeholders.push([`Placeholder G${i}`, 'G']);
        for (let i = 1; i <= 5; i++) placeholders.push([`Placeholder A${i}`, 'A']);
        for (let i = 1; i <= 3; i++) placeholders.push([`Placeholder C${i}`, 'C']);

        this.rose[team].push(...placeholders);
        // Update counters to full
        this.contatoriRuoli[team] = { "G": 5, "A": 5, "C": 3 };
    }

    // ... (Other ported logic functions would go here, e.g., verificaLimitiRuolo)

    // --- Setup Tab Functions ---

    getTeamsFromInput() {
        const teams = [];
        for (let i = 0; i < NUM_SQUADRE; i++) {
            const entry = document.getElementById(`team-entry-${i}`).value.trim();
            if (entry) teams.push(entry);
        }
        return teams;
    }

    shuffleTeams() {
        const entries = [...Array(NUM_SQUADRE).keys()].map(i => document.getElementById(`team-entry-${i}`));
        const names = entries.map(e => e.value.trim()).filter(n => n.length > 0);

        if (names.length !== NUM_SQUADRE) {
            this.showStatus("Inserisci tutti i nomi delle 10 squadre.", true);
            return;
        }

        // Fisher-Yates shuffle
        for (let i = names.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [names[i], names[j]] = [names[j], names[i]];
        }

        entries.forEach((e, i) => {
            e.value = names[i];
        });
        this.showStatus("Ordine squadre mischiato.", true);
    }

    loadPlayers(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                if (Array.isArray(data)) {
                    // Supporta sia [nome, ruolo], [nome, ruolo, squadra] che [nome, ruolo, squadra, imgUrl]
                    this.giocatoriDisponibili = data.map(arr => [
                        (arr[0] || '').trim(),
                        (arr[1] || '').trim().toUpperCase(),
                        arr[2] ? arr[2].trim() : '',
                        arr[3] ? arr[3].trim() : ''
                    ]);
                    this.listaGiocatoriOriginale = [...this.giocatoriDisponibili];
                    this.showStatus(`${this.giocatoriDisponibili.length} giocatori caricati.`, true);
                    this.updateAllPlayersList();
                } else {
                    throw new Error("Formato JSON non valido. Aspettato un array di giocatori.");
                }
            } catch (error) {
                alert(`Errore nel caricamento del file JSON: ${error.message}`);
                this.showStatus("Errore nel caricamento dei giocatori.", true);
            }
        };
        reader.readAsText(file);
    }

    generateDraft() {
        this.teams = this.getTeamsFromInput();

        if (this.teams.length !== NUM_SQUADRE) {
            this.showStatus("Inserisci tutti i nomi delle 10 squadre.", true);
            return;
        }
        // The 10th team (index 9) is prefilled with placeholders and does not participate in picks
        const pickingTeams = this.teams.slice(0, NUM_SQUADRE - 1);
        const requiredPlayers = pickingTeams.length * NUM_TURNI;
        if (this.giocatoriDisponibili.length < requiredPlayers) {
            this.showStatus("Non ci sono abbastanza giocatori per completare il draft (escludendo la 10ª squadra).", true);
            return;
        }

        const { rose, contatori } = this.inizializzaRoseEContatori(this.teams);
        this.rose = rose;
        this.contatoriRuoli = contatori;

        // Prefill placeholders for the 10th team and mark its counters full
        this.creaPlaceholdersPerDecimaSquadra();

    // Build draft sequence only with picking teams (exclude the 10th team)
    this.draftSequence = this.generaDraftSequence(pickingTeams, NUM_TURNI);
    this.pickData = this.draftSequence.map(s => ({ squadra: s, giocatore: null }));
        this.pickIndex = 0;

        this.setupRoseDisplay(); // Create the UI frames for rosters
        this.aggiornaRose();      // Populate the roster frames
        this.showCurrentPick();
        this.salvaTemporaneo();
        this.updateAllPlayersList();
        this.showStatus("Draft generato, inizia la selezione.", true);

        // Mostra draft-tab e tabs-bar, nascondi setup-tab
        const draftTab = document.getElementById('draft-tab');
        const appContainer = document.getElementById('app-container');
        if (draftTab && appContainer) {
            draftTab.style.display = 'block';
            appContainer.style.display = 'none';
        }

    }

    // --- Draft Tab Functions ---

    showCurrentPick() {
        // Mostra la pick info in alto centrale
        const pickInfoPanel = document.getElementById('pick-info-panel');
        if (pickInfoPanel) {
            if (this.pickIndex < this.draftSequence.length) {
                const squadraCorrente = this.draftSequence[this.pickIndex];
                pickInfoPanel.innerHTML = `Pick #${this.pickIndex + 1} - Tocca a: <span class="pick-info-squadra">${squadraCorrente}</span>`;
                this.playerEntry.disabled = false;
            } else {
                pickInfoPanel.textContent = "Draft completato.";
                this.playerEntry.disabled = true;
                this.showStatus("Draft completato con successo!", true);
            }
        }
        this.updatePickListbox();
    }

    autocomplete() {
        const typed = this.playerEntry.value.toLowerCase();
        this.playerSuggestions.innerHTML = '';

        if (typed.length >= 2) {
            const suggestions = this.giocatoriDisponibili
                .filter(([nome, _]) => nome.toLowerCase().includes(typed))
                .slice(0, 10);

            suggestions.forEach(([nome, ruolo]) => {
                const option = document.createElement('option');
                option.value = nome;
                this.playerSuggestions.appendChild(option);
            });
        }
    }

    assegnaGiocatore() {
        this.saveState();

        let idx;
        if (this.pickInModifica !== null) {
            idx = this.pickInModifica;
        } else if (this.pickIndex >= this.draftSequence.length) {
            return;
        } else {
            idx = this.pickIndex;
        }

        const squadra = this.draftSequence[idx];
        const nomeScelto = this.playerEntry.value.trim();
        const corrispondenti = this.giocatoriDisponibili.find(([n, r]) => n.toLowerCase() === nomeScelto.toLowerCase());

        if (!corrispondenti) {
            this.showStatus("Giocatore non trovato o già assegnato.", true);
            return;
        }

        const [nome, ruolo] = corrispondenti;
        const maxRuoli = { "G": 5, "A": 5, "C": 3 };

        // Check role limits
        if (this.contatoriRuoli[squadra][ruolo] >= maxRuoli[ruolo]) {
            this.showStatus(`${squadra} ha già il massimo di ${ruolo} (${maxRuoli[ruolo]}).`, true);
            return;
        }

        // --- Perform assignment ---

        // 1. Update roster and counters
        this.rose[squadra].push([nome, ruolo]);
        this.contatoriRuoli[squadra][ruolo]++;

    // Track last added player for styling
    this.lastAdded.team = squadra;
    this.lastAdded.ruolo = ruolo;

        // 2. Remove from available players
        const playerIndex = this.giocatoriDisponibili.findIndex(([n, r]) => n === nome && r === ruolo);
        this.giocatoriDisponibili.splice(playerIndex, 1);

        // 3. Update pick data
        this.pickData[idx].giocatore = [nome, ruolo];

        // 4. Update index/mode
        if (this.pickInModifica !== null) {
            this.pickInModifica = null;
        } else {
            this.pickIndex++;
        }

        // 5. Clean up UI and save
        this.playerEntry.value = '';
        // this.updateSelectedPlayerPanel();
        this.playerSuggestions.innerHTML = '';
        this.aggiornaRose();
        this.showCurrentPick();
        this.salvaTemporaneo();
        this.showStatus(`Giocatore '${nome}' assegnato a ${squadra}.`, true);
    }

    // --- Roster Display ---

    setupRoseDisplay() {
        this.roseContainer.innerHTML = '';
        // Crea un contenitore flex per tutte le squadre su una riga
        const rowDiv = document.createElement('div');
        rowDiv.style.display = 'flex';
        rowDiv.style.flexDirection = 'row';
        rowDiv.style.gap = 'var(--spacing-md)';
        rowDiv.style.width = '100%';
        rowDiv.style.overflowX = 'auto';

        this.teams.forEach(squadra => {
            const frame = document.createElement('div');
            frame.className = 'squadra-frame';
            frame.id = `roster-${squadra.replace(/\s/g, '-')}`;

            // Titolo squadra in cima
            const teamTitle = document.createElement('h4');
            teamTitle.className = 'squadra-title';
            teamTitle.textContent = squadra;
            frame.appendChild(teamTitle);

            ['G', 'A', 'C'].forEach(ruolo => {
                const max = { 'G': 5, 'A': 5, 'C': 3 }[ruolo];
                const tripletta = document.createElement('div');
                tripletta.className = 'tripletta';

                // Niente h4 qui, solo label e lista
                const label = document.createElement('div');
                label.className = 'slot-label';
                label.textContent = `${ruolo} (${this.contatoriRuoli[squadra][ruolo]}/${max})`;
                tripletta.appendChild(label);

                const list = document.createElement('ul');
                list.className = 'slot-list';
                list.id = `slots-${squadra.replace(/\s/g, '-')}-${ruolo}`;

                for (let i = 0; i < max; i++) {
                    const li = document.createElement('li');
                    li.className = 'player-slot';
                    li.textContent = '—';
                    list.appendChild(li);
                }
                tripletta.appendChild(list);

                frame.appendChild(tripletta);
            });

            rowDiv.appendChild(frame);
        });
        this.roseContainer.appendChild(rowDiv);
    }

    aggiornaRose() {
        if (!this.teams.length) return;

        this.teams.forEach(squadra => {
            const contatoriAssegnati = { "G": 0, "A": 0, "C": 0 };

            // Reset counters display
            const counterLabels = document.querySelectorAll(`#roster-${squadra.replace(/\s/g, '-')} .slot-label`);
            counterLabels.forEach(label => {
                const role = label.textContent.split(' ')[0];
                const max = { 'G': 5, 'A': 5, 'C': 3 }[role];
                label.textContent = `${role} (0/${max})`;
            });

            // Clear all slots
            document.querySelectorAll(`#roster-${squadra.replace(/\s/g, '-')} .player-slot`).forEach(slot => {
                slot.innerHTML = '';
            });

            // Fill slots
            this.rose[squadra].forEach(([nome, ruolo]) => {
                const list = document.getElementById(`slots-${squadra.replace(/\s/g, '-')}-${ruolo}`);
                if (list && contatoriAssegnati[ruolo] < list.children.length) {
                    const li = list.children[contatoriAssegnati[ruolo]];
                    // Cerca info aggiuntive dal pool originale (per img/team)
                    let playerInfo = this.listaGiocatoriOriginale.find(
                        ([n]) => n.toLowerCase() === nome.toLowerCase()
                    );
                    let imgUrl = '', team = '';
                    if (playerInfo) {
                        imgUrl = playerInfo[3] || '';
                        team = playerInfo[2] || '';
                    }
                    // Costruisci struttura identica a all-players-li
                    if (imgUrl) {
                        const img = document.createElement('img');
                        img.src = imgUrl;
                        img.alt = nome;
                        img.className = 'player-slot-img';
                        li.appendChild(img);
                    }
                    const nameDiv = document.createElement('div');
                    nameDiv.className = 'player-slot-name';
                    nameDiv.textContent = nome;
                    li.appendChild(nameDiv);

                    const ruoloDiv = document.createElement('div');
                    ruoloDiv.className = 'player-slot-ruolo';
                    ruoloDiv.textContent = ruolo || '';
                    li.appendChild(ruoloDiv);

                    const teamDiv = document.createElement('div');
                    teamDiv.className = 'player-team-label';
                    teamDiv.textContent = team ? team : '';
                    li.appendChild(teamDiv);

                    // Mark the most-recently added slot with the 'recent' class
                    li.classList.remove('recent');
                    if (this.lastAdded.team === squadra && this.lastAdded.ruolo === ruolo) {
                        // Only mark the most recently filled slot for this role index
                        // We compare counts: if this is the last filled index for the role, mark it
                        const isLastIndex = contatoriAssegnati[ruolo] === this.rose[squadra].filter(r => r[1] === ruolo).length - 1;
                        if (isLastIndex) li.classList.add('recent');
                    }

                    contatoriAssegnati[ruolo]++;
                }
            });

            // Update counter displays
            counterLabels.forEach(label => {
                const role = label.textContent.split(' ')[0];
                const max = { 'G': 5, 'A': 5, 'C': 3 }[role];
                label.textContent = `${role} (${contatoriAssegnati[role]}/${max})`;
            });
        });
    }

    // --- Pick List Display & Context Menu ---

    updatePickListbox() {
        this.pickListContainer.innerHTML = '';

        let roseTemp = {};
        for (const team in this.rose) {
            roseTemp[team] = [...this.rose[team]]; // Deep copy of the player lists
        }

        this.draftSequence.forEach((squadra, i) => {
            const item = document.createElement('div');
            item.className = 'pick-item';
            item.dataset.index = i;

            let text;
            if (this.pickInModifica === i) {
                text = `Pick #${i + 1}: ${squadra} - ?? (in modifica)`;
                item.classList.add('modified');
            } else if (i < this.pickIndex && this.pickData[i].giocatore) {
                // Determine which player from the roster belongs to this pick
                const [nome, ruolo] = roseTemp[squadra].shift(); // Consume the first player from the team's remaining roster
                text = `Pick #${i + 1}: ${squadra} - ${nome} (${ruolo})`;
            } else {
                text = `Pick #${i + 1}: ${squadra} - --`;
            }

            item.textContent = text;

            if (i === this.pickIndex && this.pickInModifica === null) {
                item.classList.add('current');
            }

            this.pickListContainer.appendChild(item);
        });

        // Scroll to current pick
        const currentPickElement = this.pickListContainer.querySelector('.pick-item.current');
        if (currentPickElement) {
            currentPickElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }

    showPickContextMenu(e) {
        e.preventDefault();
        const item = e.target.closest('.pick-item');
        if (!item) return;

        const idx = parseInt(item.dataset.index);

        // Simple context menu using prompt/confirm
        const action = prompt(`Azioni per Pick #${idx + 1}:\n1. Ricomincia da qui\n2. Modifica pick\n\nInserisci 1 o 2:`);

        if (action === '1') {
            this.ricominciaDaPick(idx);
        } else if (action === '2') {
            this.modificaPick(idx);
        }
    }

    ricominciaDaPick(idx) {
        if (idx >= this.draftSequence.length) return;

        if (!confirm(`Sei sicuro di voler ricominciare dalla Pick #${idx + 1}? Tutte le pick successive verranno annullate.`)) return;

        this.saveState();

        // Restore all players from idx onwards
        for (let i = idx; i < this.draftSequence.length; i++) {
            const pick = this.pickData[i];
            const g = pick.giocatore;
            if (g !== null) {
                const squadra = pick.squadra;
                const [nome, ruolo] = g;

                // Remove player from roster
                const rosterIndex = this.rose[squadra].findIndex(([n, r]) => n === nome && r === ruolo);
                if (rosterIndex !== -1) {
                    this.rose[squadra].splice(rosterIndex, 1);
                }

                this.contatoriRuoli[squadra][ruolo]--;
                this.giocatoriDisponibili.push([nome, ruolo]);
                pick.giocatore = null;
            }
        }

        this.giocatoriDisponibili.sort(); // Keep the list tidy
        this.pickIndex = idx;
        this.pickInModifica = null;
        this.redoStack = [];
    this.lastAdded = { team: null, ruolo: null };
        this.aggiornaRose();
        this.showCurrentPick();
        this.salvaTemporaneo();
        this.showStatus(`Ripristinato draft dalla pick #${idx + 1}.`, true);
    }

    modificaPick(idx) {
        if (idx >= this.pickIndex) {
            this.showStatus("Quella pick non è ancora stata assegnata.", true);
            return;
        }

        this.saveState();

        const pick = this.pickData[idx];
        const giocatore = pick.giocatore;
        const squadra = pick.squadra;

        if (!giocatore) {
            this.showStatus("Questa pick è vuota, niente da modificare.", true);
            return;
        }

        const [nome, ruolo] = giocatore;

        // Remove player from current pick and return to available pool
        const rosterIndex = this.rose[squadra].findIndex(([n, r]) => n === nome && r === ruolo);
        if (rosterIndex !== -1) {
            this.rose[squadra].splice(rosterIndex, 1);
        }
        this.contatoriRuoli[squadra][ruolo]--;
        this.giocatoriDisponibili.push([nome, ruolo]);
        this.giocatoriDisponibili.sort();
        pick.giocatore = null;

        this.pickInModifica = idx;

    // Clear lastAdded when modifying a pick to avoid stale highlight
    this.lastAdded = { team: null, ruolo: null };

    this.aggiornaRose();
        this.updatePickListbox();
        this.playerEntry.value = nome;
        this.showStatus(`Modifica Pick #${idx + 1} di ${squadra}. Inserisci un nuovo giocatore.`, false);
        this.playerEntry.focus();
    }

    // --- History (Undo/Redo) ---

    salvaSnapshotState() {
        // Deep copy data structures
        return {
            rose: JSON.parse(JSON.stringify(this.rose)),
            contatoriRuoli: JSON.parse(JSON.stringify(this.contatoriRuoli)),
            giocatoriDisponibili: JSON.parse(JSON.stringify(this.giocatoriDisponibili)),
            draftSequence: [...this.draftSequence],
            pickData: JSON.parse(JSON.stringify(this.pickData)),
            pickIndex: this.pickIndex,
        };
    }

    restoreSnapshotState(state) {
        this.rose = state.rose;
        this.contatoriRuoli = state.contatoriRuoli;
        this.giocatoriDisponibili = state.giocatoriDisponibili;
        this.draftSequence = state.draftSequence;
        this.pickData = state.pickData;
        this.pickIndex = state.pickIndex;
        // Re-generate teams list for UI setup if needed
        this.teams = [...new Set(this.draftSequence)];
    }

    saveState() {
        // Only save if there's a draft in progress
        if (this.draftSequence.length > 0) {
            const state = this.salvaSnapshotState();
            this.undoStack.push(state);
            this.redoStack = []; // Redo is cleared on new action
        }
    }

    undo() {
        if (!this.undoStack.length) {
            this.showStatus("Niente da annullare.", true);
            return;
        }

        // Save current state to redo stack
        const currentState = this.salvaSnapshotState();
        this.redoStack.push(currentState);

        // Restore last state from undo stack
        const lastState = this.undoStack.pop();
        this.restoreState(lastState);
        this.showStatus("Undo effettuato.", true);
    }

    redo() {
        if (!this.redoStack.length) {
            this.showStatus("Niente da rifare.", true);
            return;
        }

        // Save current state to undo stack
        const currentState = this.salvaSnapshotState();
        this.undoStack.push(currentState);

        // Restore next state from redo stack
        const nextState = this.redoStack.pop();
        this.restoreState(nextState);
        this.showStatus("Redo effettuato.", true);
    }

    restoreState(state) {
        this.restoreSnapshotState(state);
        if (this.teams.length > 0) {
            this.setupRoseDisplay(); // Re-render rose frames if needed
            this.aggiornaRose();
            this.showCurrentPick();
            this.playerEntry.disabled = false;
        }
    }

    // --- File & Local Storage I/O ---

    salvaTemporaneo() {
        const data = {
            rose: this.rose,
            contatoriRuoli: this.contatoriRuoli,
            giocatoriDisponibili: this.giocatoriDisponibili,
            draftSequence: this.draftSequence,
            pickData: this.pickData,
            pickIndex: this.pickIndex,
            listaGiocatoriOriginale: this.listaGiocatoriOriginale,
            teams: this.teams // Include teams for setup tab
        };
        try {
            localStorage.setItem(TEMP_FILE_KEY, JSON.stringify(data));
        } catch (e) {
            console.error("Errore nel salvataggio temporaneo:", e);
        }
    }

    askLoadTemp() {
        const tempDraft = localStorage.getItem(TEMP_FILE_KEY);
        if (tempDraft) {
            if (confirm("File di draft temporaneo trovato.\nVuoi continuare da quello?")) {
                // Make sure the welcome screen is hidden and the app UI is visible
                const welcome = document.getElementById('welcome-screen');
                const appContainer = document.getElementById('app-container');
                const header = document.querySelector('header');
                const statusBar = document.getElementById('status-bar');
                if (welcome) welcome.style.display = 'none';
                if (appContainer) appContainer.style.display = '';
                if (header) header.style.display = '';
                if (statusBar) statusBar.style.display = '';

                // Load draft data and navigate directly to the Draft tab
                this.loadDraftData(JSON.parse(tempDraft));

                const setupTab = document.getElementById('setup-tab');
                const draftTab = document.getElementById('draft-tab');
                const tabsBar = document.getElementById('tabs-bar');
                if (setupTab && draftTab && tabsBar) {
                    // Ensure tabs are visible and switch to draft
                    setupTab.style.display = 'none';
                    draftTab.style.display = 'block';
                    tabsBar.style.display = '';
                    const draftButton = document.querySelector('[data-tab="draft-tab"]');
                    if (draftButton) this.switchTab(draftButton);
                } else {
                    // Fallback: try switching to draft tab if present
                    const draftButton = document.querySelector('[data-tab="draft-tab"]');
                    if (draftButton) this.switchTab(draftButton);
                }

                this.showStatus("Draft temporaneo caricato. Passo alla pagina Draft.", true);
            } else {
                localStorage.removeItem(TEMP_FILE_KEY);
            }
        }
    }

    loadDraftData(data) {
        this.rose = data.rose;
        this.contatoriRuoli = data.contatoriRuoli;
        this.giocatoriDisponibili = data.giocatoriDisponibili;
        this.draftSequence = data.draftSequence;
        this.pickData = data.pickData || this.draftSequence.map(s => ({ squadra: s, giocatore: null }));
        this.pickIndex = data.pickIndex;
        this.listaGiocatoriOriginale = data.listaGiocatoriOriginale || [];
        this.teams = data.teams || [...new Set(data.draftSequence)];

        // Update setup tab entries
        this.teams.forEach((name, i) => {
            const input = document.getElementById(`team-entry-${i}`);
            if (input) input.value = name;
        });

        this.setupRoseDisplay();
        this.aggiornaRose();
    // Populate the searchable player list UI from the loaded state
    this.updateAllPlayersList();
        this.showCurrentPick();
        this.playerEntry.disabled = false;
        this.switchTab(document.querySelector('[data-tab="draft-tab"]'));

        this.undoStack = [];
        this.redoStack = [];
        // Ensure the 10th team has placeholders if not present or incomplete
        const tenth = this.teams && this.teams[NUM_SQUADRE - 1];
        if (tenth) {
            const counters = this.contatoriRuoli && this.contatoriRuoli[tenth];
            const hasFullCounters = counters && counters.G === 5 && counters.A === 5 && counters.C === 3;
            if (!hasFullCounters) this.creaPlaceholdersPerDecimaSquadra();
        }
    }

    salvaDraft() {
        const data = {
            rose: this.rose,
            contatoriRuoli: this.contatoriRuoli,
            giocatoriDisponibili: this.giocatoriDisponibili,
            draftSequence: this.draftSequence,
            pickData: this.pickData,
            pickIndex: this.pickIndex,
            listaGiocatoriOriginale: this.listaGiocatoriOriginale,
            teams: this.teams
        };

        // Browser API to prompt user to save a file
        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `draft_fantabasket_${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        this.showStatus("Draft salvato correttamente.", true);
    }

    loadDraft() {
        // Browser API to prompt user to load a file
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.json';
        fileInput.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    this.loadDraftData(data);
                    this.showStatus("Draft caricato con successo.", true);
                } catch (error) {
                    alert(`Errore nel caricamento del file: ${error.message}`);
                }
            };
            reader.readAsText(file);
        };
        fileInput.click();
    }

    exportRostersCsv() {
        if (!this.teams.length) {
            this.showStatus("Nessun draft generato per esportare le rose.", true);
            return;
        }

        let csvContent = "Squadra,Nome Giocatore,Ruolo\n";
        for (const squadra in this.rose) {
            this.rose[squadra].forEach(([nome, ruolo]) => {
                // Simple CSV escaping: surround names with quotes if they contain commas
                const safeNome = nome.includes(',') ? `"${nome}"` : nome;
                csvContent += `${squadra},${safeNome},${ruolo}\n`;
            });
        }

        // Browser API to prompt user to save a file
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `rose_fantabasket_${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        this.showStatus("Rose esportate con successo.", true);
    }

    // --- Other Menu Functions ---

    showGuide() {
        alert(
            "COME FUNZIONA IL DRAFT:\n" +
            "- Inserisci i nomi delle 10 squadre nell'ordine che vuoi.\n" +
            "- Carica un file JSON con i giocatori (Es: [['Nome', 'Ruolo'], ...]). Ruoli: G, A, C.\n" +
            "- Premi 'Genera Draft' per iniziare.\n" +
            "- Assegna i giocatori turno per turno rispettando i vincoli (5 G, 5 A, 3 C per squadra).\n" +
            "- Puoi salvare o riprendere il draft quando vuoi dal menu in alto."
        );
    }

    /**
     * Avvia un nuovo draft.
     * @param {boolean} fromWelcomeScreen - se true, salta il popup e non ricarica la pagina
     */
    newDraft(fromWelcomeScreen = false) {
        if (fromWelcomeScreen) {
            localStorage.removeItem(TEMP_FILE_KEY);
            // Reset solo lo stato JS, non ricaricare la pagina
            this.teams = [];
            this.giocatoriDisponibili = [];
            this.listaGiocatoriOriginale = [];
            this.rose = {};
            this.contatoriRuoli = {};
            this.draftSequence = [];
            this.pickData = [];
            this.pickIndex = 0;
            this.pickInModifica = null;
            // Pulisci i campi input
            if (this.teamEntriesContainer) this.teamEntriesContainer.innerHTML = '';
            this.setupTeamInputFields();
            // Mostra solo il setup tab
            const setupTab = document.getElementById('setup-tab');
            const draftTab = document.getElementById('draft-tab');
            const tabsBar = document.getElementById('tabs-bar');
            if (setupTab && draftTab && tabsBar) {
                setupTab.style.display = 'block';
                draftTab.style.display = 'none';
                tabsBar.style.display = 'none';
            }
            this.switchTab(document.querySelector('[data-tab="setup-tab"]'));
            this.showStatus("Nuovo draft: inserisci le squadre e carica i giocatori.", true);
            return;
        }
        if (confirm("Sei sicuro di voler iniziare un nuovo draft?\nTutti i dati non salvati andranno persi.")) {
            localStorage.removeItem(TEMP_FILE_KEY);
            window.location.reload(); // Simplest way to restart a client-side app
        }
    }

    resetDraftConfirm() {
        if (confirm("Sei sicuro di voler resettare il draft?\nTutti i giocatori assegnati verranno rimossi e si ripartirà dalla Pick #1.")) {
            this.saveState();
            this.resetDraftState();
            this.salvaTemporaneo();
            this.showStatus("Draft resettato.", true);
        }
    }

    resetDraftState() {
        // Reset rosters for picking teams (exclude 10th team which keeps placeholders)
        const pickingTeams = this.teams.slice(0, NUM_SQUADRE - 1);
        this.rose = pickingTeams.reduce((acc, team) => ({ ...acc, [team]: [] }), {});
        // Ensure the 10th team key exists so UI can render it
        const tenth = this.teams[NUM_SQUADRE - 1];
        if (tenth) this.rose[tenth] = this.rose[tenth] || [];

        this.contatoriRuoli = pickingTeams.reduce((acc, team) => ({ ...acc, [team]: { "G": 0, "A": 0, "C": 0 } }), {});
        if (tenth) this.contatoriRuoli[tenth] = this.contatoriRuoli[tenth] || { "G": 0, "A": 0, "C": 0 };

        this.giocatoriDisponibili = [...this.listaGiocatoriOriginale];
        this.giocatoriDisponibili.sort();

        // Rebuild draftSequence only for picking teams and reset pick data
        this.draftSequence = this.generaDraftSequence(pickingTeams, NUM_TURNI);
        this.pickData = this.draftSequence.map(s => ({ squadra: s, giocatore: null }));
        this.pickIndex = 0;
        this.pickInModifica = null;
        this.redoStack = [];
    // Clear lastAdded and recreate placeholders for the 10th team
    this.lastAdded = { team: null, ruolo: null };
        
    // Recreate placeholders for the 10th team
        this.creaPlaceholdersPerDecimaSquadra();

        this.aggiornaRose();
        this.showCurrentPick();
    }
}

// Initialize the application when the DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.draftApp = new DraftApp();
});

// Safety: ensure the tabs bar is never visible even if other scripts try to show it.
// This runs outside the DraftApp class so it executes as soon as DOM is ready.
document.addEventListener('DOMContentLoaded', () => {
    const hideTabsBar = () => {
        const el = document.getElementById('tabs-bar');
        if (el) {
            try {
                el.style.setProperty('display', 'none', 'important');
                el.style.setProperty('visibility', 'hidden', 'important');
                el.style.setProperty('height', '0', 'important');
                el.style.setProperty('min-height', '0', 'important');
                el.style.setProperty('overflow', 'hidden', 'important');
            } catch (e) {
                // ignore
            }
        }
    };

    // Initial hide
    hideTabsBar();

    // Observe attribute changes to re-hide if some script modifies inline styles
    const observer = new MutationObserver(mutations => {
        for (const m of mutations) {
            if (m.type === 'attributes' && m.target && m.target.id === 'tabs-bar') {
                hideTabsBar();
            }
        }
    });

    const target = document.getElementById('tabs-bar');
    if (target) {
        observer.observe(target, { attributes: true, attributeFilter: ['style', 'class'] });
    } else {
        // If not present yet, watch the body for added nodes
        const bodyObs = new MutationObserver((mutations, obs) => {
            for (const m of mutations) {
                for (const node of m.addedNodes) {
                    if (node.nodeType === 1 && node.id === 'tabs-bar') {
                        hideTabsBar();
                        observer.observe(node, { attributes: true, attributeFilter: ['style', 'class'] });
                        obs.disconnect();
                        return;
                    }
                }
            }
        });
        bodyObs.observe(document.body, { childList: true, subtree: true });
    }
});