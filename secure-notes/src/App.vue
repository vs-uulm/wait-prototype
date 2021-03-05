<template>
  <v-app>
    <v-main>
      <v-container class="fill-height" fluid>
        <v-row align="center" justify="center">
          <v-col cols="12" sm="8" md="4">
            <v-card class="elevation-12">
              <v-toolbar color="primary" dark flat>
                <v-toolbar-title>
                  <v-icon left>mdi-notebook-edit-outline</v-icon>
                  Secure Notes
                </v-toolbar-title>

                <v-spacer />

                <v-toolbar-items>
                  <v-select
                    label="Select Note..."
                    class="mt-3 mr-3"
                    v-model="note"
                    :items="notes"
                    item-text="title"
                    item-value="id"
                    solo
                    dense
                    @change="loadNote"
                    return-object
                    prepend-inner-icon="mdi-note-text-outline" />

                  <v-btn icon @click="createNote">
                    <v-icon>mdi-plus-circle</v-icon>
                  </v-btn>
                  <v-btn icon @click="logout" color="error">
                    <v-icon>mdi-logout-variant</v-icon>
                  </v-btn>
                </v-toolbar-items>
              </v-toolbar>

              <v-form @submit.prevent="storeNotes">
                <v-card-text v-if="currentNote">
                    <v-text-field label="Title" v-model="currentNote.title" outlined @change="dirty = true" :disabled="loading" />
                    <v-textarea label="Note" v-model="currentNote.content" outlined rows="20" @change="dirty = true" :disabled="loading" />
                </v-card-text>

                <v-card-actions>
                  Connected to: <span class="ml-2 caption monospace">{{ this.endpoint }}</span>
                  <v-spacer />
                  <v-btn color="primary" type="submit">
                    <v-icon left>mdi-content-save</v-icon>
                    Save
                  </v-btn>
                </v-card-actions>
              </v-form>
            </v-card>
          </v-col>
        </v-row>
      </v-container>

      <v-dialog v-model="saveDialog" persistent max-width="400">
        <v-card>
          <v-card-title class="headline">Unsaved changes</v-card-title>

          <v-card-text>
            You have unsaved changes made to '{{ title }}' which will be lost if you navigate away.
            Are you sure you wish to discard these changes?
          </v-card-text>

          <v-card-actions>
            <v-spacer></v-spacer>
            <v-btn text @click="discardChanges" color="error">Discard</v-btn>
            <v-btn text @click="cancelLoad">Cancel</v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>

      <v-dialog v-model="initDialog" persistent max-width="600">
        <v-card>
          <v-card-title class="headline">Secure Notes</v-card-title>

          <v-form class="mt-5" @submit.prevent="openVault">
            <v-card-text>
              Select a RESTful Endpoint to store your encrypted notes or leave it empty to create a new vault for your notes.
              In addition you have to provide an encryption password that will be used to derive the encryption keys of your note.
              This password will never leave your browser.

              <v-text-field
                      label="Endpoint"
                      v-model="create.endpoint"
                      prepend-inner-icon="mdi-link-variant"
                      outlined />

              <v-text-field
                      label="Encryption Password"
                      v-model="create.password"
                      prepend-inner-icon="mdi-textbox-password"
                      :append-icon="create.showPassword ? 'mdi-eye' : 'mdi-eye-off'"
                      :type="create.showPassword ? 'text' : 'password'"
                      @click:append="create.showPassword = !create.showPassword"
                      autofocus
                      outlined />
            </v-card-text>

            <v-card-actions>
              <v-spacer></v-spacer>
              <v-btn text type="submit" color="success" :disabled="!create.password">
                {{ create.endpoint ? 'Open' : 'Create' }} Vault
              </v-btn>
            </v-card-actions>
          </v-form>
        </v-card>
      </v-dialog>

      <v-overlay :value="overlay">
        <v-progress-circular indeterminate size="128" />
      </v-overlay>
    </v-main>
  </v-app>
</template>

<script>
import axios from 'axios';

export default {
  name: 'App',

  async mounted() {
    this.endpoint = window.localStorage.getItem('endpoint');

    if (this.endpoint) {
      this.create.endpoint = this.endpoint;
    }

    this.initDialog = true;
  },

  data() {
    return {
      API_KEY: 'b3bbc5ce-0992-11eb-9cec-0242ac110002',

      password: '',
      endpoint: '',

      content: '',
      title: '',
      note: false,
      notes: [],
      dirty: false,

      saveDialog: false,
      currentNote: null,

      loading: false,
      overlay: false,

      initDialog: false,
      create: {
        endpoint: '',
        password: '',
        showPassword: false
      }
    };
  },

  methods: {
    loadNote(note) {
      if (this.currentNote === note) {
        return;
      }

      if (this.dirty) {
        this.saveDialog = true;
        return;
      }

      this.dirty = false;
      this.saveDialog = false;
      this.currentNote = note;
      this.loading = false;
    },

    discardChanges() {
      this.dirty = false;
      this.loadNote(this.note);
    },

    cancelLoad() {
      this.saveDialog = false;
      this.note = this.currentNote;
    },

    async fetchNotes() {
      try {
        this.loading = true;
        const res = await axios.get(this.endpoint);

        if (res.data.iv && res.data.salt && res.data.encryptedNotes) {
          const encoder = new TextEncoder();
          const decoder = new TextDecoder();

          const iv = Uint8Array.from(res.data.iv);
          const salt = Uint8Array.from(res.data.salt);
          const encryptedNotes = Uint8Array.from(res.data.encryptedNotes);
          const key = await window.crypto.subtle.importKey('raw', encoder.encode(this.password), { name: 'PBKDF2' }, false, ['deriveKey']);
          const decryptionKey = await window.crypto.subtle.deriveKey({
            name: 'PBKDF2',
            salt: salt,
            iterations: 1000,
            hash: { name: 'SHA-512'}
          }, key, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
          const decryptedNotes = await window.crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv }, decryptionKey, encryptedNotes);
          this.notes = JSON.parse(decoder.decode(decryptedNotes));
        }
      } catch {
        this.endpoint = '';
        this.password = '';
        this.initDialog = true;
      } finally {
        this.loading = false;
      }
    },

    async storeNotes() {
      try {
        this.loading = true;

        const encoder = new TextEncoder();

        const iv = window.crypto.getRandomValues(new Uint8Array(12));
        const salt = window.crypto.getRandomValues(new Uint8Array(16));
        const key = await window.crypto.subtle.importKey('raw', encoder.encode(this.password), { name: 'PBKDF2' }, false, ['deriveKey']);
        const encryptionKey = await window.crypto.subtle.deriveKey({
          name: 'PBKDF2',
          salt: salt,
          iterations: 1000,
          hash: { name: 'SHA-512'}
        }, key, { name: 'AES-GCM', length: 256 }, false, ['encrypt']);

        const data = encoder.encode(JSON.stringify(this.notes));
        const encryptedNotes = await window.crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, encryptionKey, data);

        await axios.put(this.endpoint, {
          iv: Array.from(iv),
          salt: Array.from(salt),
          encryptedNotes: Array.from(new Uint8Array(encryptedNotes))
        });
        this.dirty = false;
      } catch {
        this.endpoint = '';
        this.password = '';
        this.initDialog = true;
      } finally {
        this.loading = false;
      }
    },

    async createNote() {
      this.currentNote = Object.assign({}, {
        id: this.notes.length,
        title: 'Untitled Note',
        content: '...'
      });

      this.notes.push(this.currentNote);
      this.note = this.currentNote;
      this.dirty = true;
    },

    async openVault() {
      if (!this.create.password) {
        return;
      }

      this.password = this.create.password;
      this.initDialog = false;
      this.overlay = true;

      if (this.create.endpoint) {
        this.endpoint = this.create.endpoint;
      } else {
        const res = await axios.post('https://json.extendsclass.com/bin', { notes: [] }, {
          headers: { 'API-Key': this.API_KEY }
        });

        this.endpoint = res.data.uri;
      }

      window.localStorage.setItem('endpoint', this.endpoint);

      this.overlay = false;
      await this.fetchNotes();
    },

    logout() {
      this.endpoint = '';
      this.password = '';
      this.notes = [];
      this.currentNote = null;
      this.note = null;
      this.dirty = false;
      this.initDialog = true;
      this.create.endpoint = '';
      this.create.password = '';

      window.localStorage.removeItem('endpoint');
    }
  }
}
</script>

<style scoped>
.monospace {
  font-family: monospace;
}
</style>