# Terminal yang nyaman: zsh dan Neovim

Untuk kerja harian di terminal server lewat Bitvise: memeriksa server (`free -h`, `df -h`, `docker compose ps`), melihat log, menjalankan deploy. Bukan untuk mengedit kode aplikasi; kode dan konfigurasi diubah lewat repo dan PR.

zsh dan Neovim hanya memakai beberapa MB RAM per sesi, jadi tidak memberatkan server.

## Aturan

- Dipasang untuk **akun admin pribadi** ([akun-admin.md](akun-admin.md)), **bukan root**. Shell root tetap bash.
- Skrip (`setup.sh`, `check.sh`, `sigrak-setup.sh`, deploy, backup) tetap berjalan dengan bash karena baris pertamanya `#!/usr/bin/env bash`. Shell yang Anda pakai tidak mengubah perilaku skrip.
- Plugin dari paket Ubuntu (apt), bukan dari `curl | sh`. Oh My Zsh boleh di akun pribadi bila pembaruan otomatisnya dimatikan.
- Neovim dengan konfigurasi minimal, tanpa plugin manager (LazyVim dan sejenisnya hanya di laptop).

## Pasang (sekali, dari akun admin)

```bash
sudo apt install -y zsh zsh-autosuggestions zsh-syntax-highlighting neovim
chsh -s /usr/bin/zsh            # your own account only, never root
```

Isi `~/.zshrc`:

```bash
# history
HISTFILE=~/.zsh_history
HISTSIZE=5000
SAVEHIST=5000
setopt HIST_IGNORE_SPACE HIST_IGNORE_DUPS SHARE_HISTORY

# plugins from Ubuntu packages
source /usr/share/zsh-autosuggestions/zsh-autosuggestions.zsh
source /usr/share/zsh-syntax-highlighting/zsh-syntax-highlighting.zsh

# prompt with the server label, so nobody types on the wrong server
PROMPT='%F{cyan}[sigrak-1]%f %F{yellow}%n%f %~ %# '

export EDITOR=nvim

# idle logout outside tmux (terminal-safety.md)
[ -z "$TMUX" ] && TMOUT=900

# short commands
alias dps='sudo docker compose ps'
alias dlogs='sudo docker compose logs -f --tail=100'
alias check='sudo bash /opt/apps/_fondasi/server/check.sh'
```

Ganti `[sigrak-1]` dengan label servernya: `[sigrak-2]` untuk VPS cadangan, dan tandai staging dengan jelas.

`HIST_IGNORE_SPACE`: perintah yang diawali spasi tidak disimpan di riwayat. Pakai ini bila suatu saat terpaksa mengetik sesuatu yang sensitif.

Konfigurasi Neovim minimal, `~/.config/nvim/init.lua`:

```lua
vim.opt.number = true
vim.opt.mouse = "a"
vim.opt.expandtab = true
vim.opt.shiftwidth = 2
vim.opt.undofile = false
vim.opt.swapfile = false
```

Keluar, lalu login lagi lewat Bitvise: prompt zsh langsung muncul.

## Bitvise

- Tab **Terminal**: emulasi `xterm-256color`, encoding **UTF-8**.
- Hindari tema prompt yang butuh "Nerd Font" (ikon khusus): terminal Bitvise tidak selalu menampilkannya.
- Ingin tampilan lebih bagus? Buka terminal lewat **Windows Terminal** dengan kunci yang sama (`ssh -p <port> arumi@<address>`), dan tetap pakai Bitvise untuk SFTP dan tunnel.

## Oh My Zsh (opsional, akun pribadi saja)

Bila ingin memakainya, pasang dari akun admin (bukan root), lalu matikan pembaruan otomatis di `~/.zshrc`:

```bash
zstyle ':omz:update' mode disabled
```

Pilih tema sederhana (misalnya `robbyrussell`) dan sedikit plugin (`git`, `docker`). Perbarui secara manual sesekali.

## Contoh kerja harian

```bash
free -h                     # memory
df -h                       # disk
dps                         # containers of the current compose project
dlogs web                   # follow the web logs
check                       # Fondasi check.sh, expect S9
tmux new -s deploy-2027.1.0
sudo /opt/apps/sigrak/src/deploy/deploy.sh production 2027.1.0   # built in R3
```

Deploy dan pekerjaan panjang selalu di dalam tmux ([terminal-safety.md](terminal-safety.md)).

## Otomatis di R3

`sigrak-setup.sh` (R3) akan memasang paket di atas dan menyiapkan `~/.zshrc` serta `init.lua` untuk akun admin, dengan label server yang benar, supaya server utama, cadangan, dan staging sama persis tanpa setel manual. Sampai saat itu, ikuti langkah manual di atas.
