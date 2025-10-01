// app.js

const NUM_SQUADRE = 10;
const NUM_TURNI = 13;
const TEMP_FILE_KEY = "fantabasket_draft_temp"; // Using localStorage for temp save

class DraftApp {
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

        this.setupDOMReferences();
        this.setupEventListeners();
        this.setupTeamInputFields();
        this.askLoadTemp();
        this.showStatus("----- Avvio completato -----", false);
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
        this.playerEntry.addEventListener('input', () => this.autocomplete());
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

        // NOTE: This is simplified to expect a JSON file with an array of [Name, Role] tuples.
        // E.g., [['LeBron James', 'A'], ['Luka Doncic', 'G'], ...]
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                if (Array.isArray(data)) {
                    this.giocatoriDisponibili = data.map(([nome, ruolo]) => [nome.trim(), ruolo.trim().toUpperCase()]);
                    this.listaGiocatoriOriginale = [...this.giocatoriDisponibili];
                    this.showStatus(`${this.giocatoriDisponibili.length} giocatori caricati.`, true);
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
        if (this.giocatoriDisponibili.length < NUM_SQUADRE * NUM_TURNI) {
            this.showStatus("Non ci sono abbastanza giocatori per completare il draft.", true);
            return;
        }

        const { rose, contatori } = this.inizializzaRoseEContatori(this.teams);
        this.rose = rose;
        this.contatoriRuoli = contatori;

        this.draftSequence = this.generaDraftSequence(this.teams, NUM_TURNI);
        this.pickData = this.draftSequence.map(s => ({ squadra: s, giocatore: null }));
        this.pickIndex = 0;

        this.setupRoseDisplay(); // Create the UI frames for rosters
        this.aggiornaRose();      // Populate the roster frames
        this.showCurrentPick();
        this.salvaTemporaneo();
        this.showStatus("Draft generato, inizia la selezione.", true);
        this.switchTab(document.querySelector('[data-tab="draft-tab"]'));
    }

    // --- Draft Tab Functions ---

    showCurrentPick() {
        if (this.pickIndex < this.draftSequence.length) {
            const squadraCorrente = this.draftSequence[this.pickIndex];
            this.pickLabel.textContent = `Pick #${this.pickIndex + 1} - Tocca a: ${squadraCorrente}`;
            document.getElementById('assign-button').disabled = false;
            this.playerEntry.disabled = false;
        } else {
            this.pickLabel.textContent = "Draft completato.";
            document.getElementById('assign-button').disabled = true;
            this.playerEntry.disabled = true;
            this.showStatus("Draft completato con successo!", true);
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
        this.playerSuggestions.innerHTML = '';
        this.aggiornaRose();
        this.showCurrentPick();
        this.salvaTemporaneo();
        this.showStatus(`Giocatore '${nome}' assegnato a ${squadra}.`, true);
    }

    // --- Roster Display ---

    setupRoseDisplay() {
        this.roseContainer.innerHTML = '';
        this.teams.forEach(squadra => {
            const frame = document.createElement('div');
            frame.className = 'squadra-frame';
            frame.id = `roster-${squadra.replace(/\s/g, '-')}`;

            ['G', 'A', 'C'].forEach(ruolo => {
                const max = { 'G': 5, 'A': 5, 'C': 3 }[ruolo];
                const tripletta = document.createElement('div');
                tripletta.className = 'tripletta';

                const title = document.createElement('h4');
                title.textContent = squadra + ' - ' + ruolo;
                tripletta.appendChild(title);

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

            this.roseContainer.appendChild(frame);
        });
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
                slot.textContent = '—';
            });

            // Fill slots
            this.rose[squadra].forEach(([nome, ruolo]) => {
                const list = document.getElementById(`slots-${squadra.replace(/\s/g, '-')}-${ruolo}`);
                if (list && contatoriAssegnati[ruolo] < list.children.length) {
                    list.children[contatoriAssegnati[ruolo]].textContent = nome;
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
                this.loadDraftData(JSON.parse(tempDraft));
                this.showStatus("Draft temporaneo caricato.", true);
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
        this.showCurrentPick();
        this.playerEntry.disabled = false;
        this.switchTab(document.querySelector('[data-tab="draft-tab"]'));
        
        this.undoStack = [];
        this.redoStack = [];
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

    newDraft() {
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
        this.rose = this.teams.reduce((acc, team) => ({ ...acc, [team]: [] }), {});
        this.contatoriRuoli = this.teams.reduce((acc, team) => ({ ...acc, [team]: { "G": 0, "A": 0, "C": 0 } }), {});
        this.giocatoriDisponibili = [...this.listaGiocatoriOriginale];
        this.giocatoriDisponibili.sort();
        
        this.pickData = this.draftSequence.map(s => ({ squadra: s, giocatore: null }));
        this.pickIndex = 0;
        this.pickInModifica = null;
        this.redoStack = [];

        this.aggiornaRose();
        this.showCurrentPick();
    }
}

// Initialize the application when the DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.draftApp = new DraftApp();
});