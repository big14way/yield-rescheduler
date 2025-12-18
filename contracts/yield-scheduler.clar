;; yield-scheduler.clar
;; Time-based yield scheduler with bonus periods
;; Uses Clarity 4 features: stacks-block-time, to-ascii?

(define-constant CONTRACT_OWNER tx-sender)
(define-constant ERR_NOT_AUTHORIZED (err u8001))
(define-constant ERR_SCHEDULE_PAUSED (err u220))
(define-constant ERR_POOL_NOT_FOUND (err u8002))
(define-constant ERR_SCHEDULE_PAUSED (err u220))
(define-constant ERR_INSUFFICIENT_STAKE (err u8003))
(define-constant ERR_SCHEDULE_PAUSED (err u220))
(define-constant ERR_COOLDOWN_ACTIVE (err u8004))
(define-constant ERR_SCHEDULE_PAUSED (err u220))
(define-constant ERR_NO_REWARDS (err u8005))
(define-constant ERR_SCHEDULE_PAUSED (err u220))
(define-constant ERR_INVALID_AMOUNT (err u8006))
(define-constant ERR_SCHEDULE_PAUSED (err u220))

(define-constant SCHEDULE_LINEAR u0)
(define-constant SCHEDULE_BONUS_WEEKEND u1)
(define-constant SCHEDULE_TIERED u2)
(define-constant SCHEDULE_DECAY u3)

(define-constant ONE_DAY u86400)
(define-constant ONE_HOUR u3600)

(define-data-var pool-counter uint u0)
(define-data-var total-staked uint u0)
(define-data-var total-rewards-distributed uint u0)

(define-map pools uint {
    name: (string-ascii 64), reward-rate: uint, schedule-type: uint,
    min-stake: uint, cooldown-period: uint, total-staked: uint,
    rewards-pool: uint, created-at: uint, active: bool
})

(define-map bonus-schedules { pool-id: uint, schedule-index: uint } {
    name: (string-ascii 32), multiplier: uint, start-time: uint,
    end-time: uint, active: bool
})

(define-map pool-schedule-count uint uint)

(define-map stakes { pool-id: uint, staker: principal } {
    amount: uint, staked-at: uint, last-claim: uint,
    rewards-earned: uint, cooldown-end: uint
})

(define-read-only (get-current-time) stacks-block-time)

(define-read-only (get-pool (pool-id uint)) (map-get? pools pool-id))

(define-read-only (get-stake (pool-id uint) (staker principal))
    (map-get? stakes { pool-id: pool-id, staker: staker }))

(define-read-only (get-bonus-schedule (pool-id uint) (index uint))
    (map-get? bonus-schedules { pool-id: pool-id, schedule-index: index }))

(define-read-only (get-day-of-week)
    (mod (/ stacks-block-time ONE_DAY) u7))

(define-read-only (is-weekend)
    (let ((day (get-day-of-week)))
        (or (is-eq day u0) (is-eq day u6))))

(define-read-only (get-current-multiplier (pool-id uint))
    (let ((pool (unwrap! (map-get? pools pool-id) u10000))
          (schedule-count (default-to u0 (map-get? pool-schedule-count pool-id))))
        (if (is-eq (get schedule-type pool) SCHEDULE_BONUS_WEEKEND)
            (if (is-weekend) u20000 u10000)
            (get multiplier (fold check-active-bonus (list u0 u1 u2 u3 u4) { pool-id: pool-id, multiplier: u10000 })))))

(define-private (check-active-bonus (index uint) (acc { pool-id: uint, multiplier: uint }))
    (match (map-get? bonus-schedules { pool-id: (get pool-id acc), schedule-index: index })
        schedule (if (and (get active schedule)
                         (>= stacks-block-time (get start-time schedule))
                         (<= stacks-block-time (get end-time schedule)))
                    { pool-id: (get pool-id acc), multiplier: (get multiplier schedule) }
                    acc)
        acc))

(define-read-only (calculate-pending-rewards (pool-id uint) (staker principal))
    (match (map-get? stakes { pool-id: pool-id, staker: staker })
        stake-data (match (map-get? pools pool-id)
            pool-data (let ((time-elapsed (- stacks-block-time (get last-claim stake-data)))
                      (base-reward (/ (* (get amount stake-data) (get reward-rate pool-data) time-elapsed) ONE_DAY))
                      (multiplier (get-current-multiplier pool-id)))
                (/ (* base-reward multiplier) u10000))
            u0)
        u0))

(define-read-only (generate-pool-status (pool-id uint))
    (match (map-get? pools pool-id)
        pool (let ((id-str (unwrap-panic (to-ascii? pool-id)))
                  (staked-str (unwrap-panic (to-ascii? (get total-staked pool))))
                  (rate-str (unwrap-panic (to-ascii? (get reward-rate pool)))))
            (concat (concat (concat "Pool #" id-str) (concat ": " (get name pool)))
                    (concat (concat " | Staked: " staked-str) (concat " | Rate: " rate-str))))
        "Pool not found"))

(define-read-only (generate-stake-info (pool-id uint) (staker principal))
    (match (map-get? stakes { pool-id: pool-id, staker: staker })
        user-stake (let ((amount-str (unwrap-panic (to-ascii? (get amount user-stake))))
                   (earned-str (unwrap-panic (to-ascii? (get rewards-earned user-stake)))))
            (concat (concat "Staked: " amount-str) (concat " | Earned: " earned-str)))
        "No stake found"))

(define-read-only (get-protocol-stats)
    { total-pools: (var-get pool-counter),
      total-staked: (var-get total-staked),
      total-rewards: (var-get total-rewards-distributed),
      current-time: stacks-block-time })

(define-public (create-pool (name (string-ascii 64)) (reward-rate uint) (schedule-type uint) (min-stake uint) (cooldown-period uint) (initial-rewards uint))
    (let ((pool-id (+ (var-get pool-counter) u1)))
        (asserts! (is-eq tx-sender CONTRACT_OWNER) ERR_NOT_AUTHORIZED)
        (asserts! (> reward-rate u0) ERR_INVALID_AMOUNT)
        (map-set pools pool-id {
            name: name, reward-rate: reward-rate, schedule-type: schedule-type,
            min-stake: min-stake, cooldown-period: cooldown-period, total-staked: u0,
            rewards-pool: u0, created-at: stacks-block-time, active: true })
        (var-set pool-counter pool-id)
        (print (generate-pool-status pool-id))
        (ok pool-id)))

(define-public (add-bonus-schedule (pool-id uint) (name (string-ascii 32)) (multiplier uint) (start-time uint) (duration uint))
    (let ((pool (unwrap! (map-get? pools pool-id) ERR_POOL_NOT_FOUND))
          (schedule-count (default-to u0 (map-get? pool-schedule-count pool-id))))
        (asserts! (is-eq tx-sender CONTRACT_OWNER) ERR_NOT_AUTHORIZED)
        (asserts! (< schedule-count u5) ERR_NOT_AUTHORIZED)
        (map-set bonus-schedules { pool-id: pool-id, schedule-index: schedule-count } {
            name: name, multiplier: multiplier, start-time: start-time,
            end-time: (+ start-time duration), active: true })
        (map-set pool-schedule-count pool-id (+ schedule-count u1))
        (print { event: "bonus-schedule-added", pool-id: pool-id, schedule-index: schedule-count, name: name, multiplier: multiplier })
        (ok schedule-count)))

(define-public (stake (pool-id uint) (amount uint))
    (let ((caller tx-sender)
          (pool (unwrap! (map-get? pools pool-id) ERR_POOL_NOT_FOUND))
          (existing-stake (default-to { amount: u0, staked-at: u0, last-claim: u0, rewards-earned: u0, cooldown-end: u0 }
                                     (map-get? stakes { pool-id: pool-id, staker: caller }))))
        (asserts! (get active pool) ERR_POOL_NOT_FOUND)
        (asserts! (>= amount (get min-stake pool)) ERR_INSUFFICIENT_STAKE)
        (map-set stakes { pool-id: pool-id, staker: caller } {
            amount: (+ (get amount existing-stake) amount),
            staked-at: (if (is-eq (get amount existing-stake) u0) stacks-block-time (get staked-at existing-stake)),
            last-claim: stacks-block-time,
            rewards-earned: (get rewards-earned existing-stake),
            cooldown-end: u0 })
        (map-set pools pool-id (merge pool { total-staked: (+ (get total-staked pool) amount) }))
        (var-set total-staked (+ (var-get total-staked) amount))
        (print { event: "staked", pool-id: pool-id, staker: caller, amount: amount, total-amount: (+ (get amount existing-stake) amount) })
        (ok true)))

(define-public (unstake (pool-id uint) (amount uint))
    (let ((caller tx-sender)
          (pool (unwrap! (map-get? pools pool-id) ERR_POOL_NOT_FOUND))
          (stake-info (unwrap! (map-get? stakes { pool-id: pool-id, staker: caller }) ERR_INSUFFICIENT_STAKE)))
        (asserts! (>= (get amount stake-info) amount) ERR_INSUFFICIENT_STAKE)
        (asserts! (or (is-eq (get cooldown-period pool) u0)
                     (>= stacks-block-time (get cooldown-end stake-info))) ERR_COOLDOWN_ACTIVE)
        (map-set stakes { pool-id: pool-id, staker: caller } (merge stake-info {
            amount: (- (get amount stake-info) amount),
            cooldown-end: (+ stacks-block-time (get cooldown-period pool)) }))
        (map-set pools pool-id (merge pool { total-staked: (- (get total-staked pool) amount) }))
        (var-set total-staked (- (var-get total-staked) amount))
        (print { event: "unstaked", pool-id: pool-id, staker: caller, amount: amount, remaining: (- (get amount stake-info) amount) })
        (ok true)))

(define-public (claim-rewards (pool-id uint))
    (let ((caller tx-sender)
          (pool (unwrap! (map-get? pools pool-id) ERR_POOL_NOT_FOUND))
          (stake-info (unwrap! (map-get? stakes { pool-id: pool-id, staker: caller }) ERR_INSUFFICIENT_STAKE))
          (pending (calculate-pending-rewards pool-id caller)))
        (asserts! (> pending u0) ERR_NO_REWARDS)
        (asserts! (<= pending (get rewards-pool pool)) ERR_NO_REWARDS)
        (map-set stakes { pool-id: pool-id, staker: caller } (merge stake-info {
            last-claim: stacks-block-time,
            rewards-earned: (+ (get rewards-earned stake-info) pending) }))
        (map-set pools pool-id (merge pool { rewards-pool: (- (get rewards-pool pool) pending) }))
        (var-set total-rewards-distributed (+ (var-get total-rewards-distributed) pending))
        (print { event: "rewards-claimed", pool-id: pool-id, staker: caller, amount: pending, total-earned: (+ (get rewards-earned stake-info) pending) })
        (ok pending)))

(define-public (compound (pool-id uint))
    (let ((caller tx-sender)
          (pool (unwrap! (map-get? pools pool-id) ERR_POOL_NOT_FOUND))
          (stake-info (unwrap! (map-get? stakes { pool-id: pool-id, staker: caller }) ERR_INSUFFICIENT_STAKE))
          (pending (calculate-pending-rewards pool-id caller)))
        (asserts! (> pending u0) ERR_NO_REWARDS)
        (asserts! (<= pending (get rewards-pool pool)) ERR_NO_REWARDS)
        (map-set stakes { pool-id: pool-id, staker: caller } (merge stake-info {
            amount: (+ (get amount stake-info) pending),
            last-claim: stacks-block-time,
            rewards-earned: (+ (get rewards-earned stake-info) pending) }))
        (map-set pools pool-id (merge pool {
            total-staked: (+ (get total-staked pool) pending),
            rewards-pool: (- (get rewards-pool pool) pending) }))
        (var-set total-staked (+ (var-get total-staked) pending))
        (var-set total-rewards-distributed (+ (var-get total-rewards-distributed) pending))
        (print { event: "compounded", pool-id: pool-id, staker: caller, amount: pending, new-total: (+ (get amount stake-info) pending) })
        (ok pending)))

(define-public (fund-rewards-pool (pool-id uint) (amount uint))
    (let ((pool (unwrap! (map-get? pools pool-id) ERR_POOL_NOT_FOUND)))
        (map-set pools pool-id (merge pool { rewards-pool: (+ (get rewards-pool pool) amount) }))
        (print { event: "pool-funded", pool-id: pool-id, funder: tx-sender, amount: amount, new-total: (+ (get rewards-pool pool) amount) })
        (ok true)))

(define-public (set-pool-active (pool-id uint) (active bool))
    (let ((pool (unwrap! (map-get? pools pool-id) ERR_POOL_NOT_FOUND)))
        (asserts! (is-eq tx-sender CONTRACT_OWNER) ERR_NOT_AUTHORIZED)
        (map-set pools pool-id (merge pool { active: active }))
        (print { event: "pool-status-changed", pool-id: pool-id, active: active, admin: tx-sender })
        (ok true)))
