;; yield-optimizer.clar
;; Automated yield optimization and cross-pool rebalancing system
;; Uses Clarity 4 with comprehensive Chainhook integration

;; ========================================
;; Constants
;; ========================================

(define-constant CONTRACT_OWNER tx-sender)
(define-constant ERR_NOT_AUTHORIZED (err u60001))
(define-constant ERR_INVALID_STRATEGY (err u60002))
(define-constant ERR_STRATEGY_NOT_FOUND (err u60003))
(define-constant ERR_INSUFFICIENT_BALANCE (err u60004))
(define-constant ERR_REBALANCE_FAILED (err u60005))
(define-constant ERR_INVALID_THRESHOLD (err u60006))
(define-constant ERR_ALREADY_OPTIMIZED (err u60007))
(define-constant ERR_COOLDOWN_ACTIVE (err u60008))

;; Optimization strategies
(define-constant STRATEGY_MAX_YIELD u1)
(define-constant STRATEGY_BALANCED u2)
(define-constant STRATEGY_LOW_RISK u3)
(define-constant STRATEGY_AGGRESSIVE u4)

;; Rebalancing thresholds
(define-constant MIN_REBALANCE_THRESHOLD u50) ;; 0.5% difference
(define-constant REBALANCE_COOLDOWN u144) ;; ~1 day in blocks

;; ========================================
;; Data Variables
;; ========================================

(define-data-var strategy-counter uint u0)
(define-data-var rebalance-counter uint u0)
(define-data-var optimization-fee-bps uint u25) ;; 0.25%
(define-data-var total-value-optimized uint u0)
(define-data-var total-fees-collected uint u0)

;; ========================================
;; Data Maps
;; ========================================

;; User optimization strategies
(define-map user-strategies
    principal
    {
        strategy-type: uint,
        auto-rebalance: bool,
        rebalance-threshold: uint,
        last-rebalance: uint,
        total-rebalances: uint,
        total-value-moved: uint,
        active: bool,
        created-at: uint
    }
)

;; Pool yield tracking
(define-map pool-yields
    uint
    {
        pool-id: uint,
        current-apy: uint,
        average-apy: uint,
        total-deposits: uint,
        total-rewards: uint,
        risk-score: uint,
        last-updated: uint,
        active: bool
    }
)

;; User pool allocations
(define-map user-allocations
    { user: principal, pool-id: uint }
    {
        amount: uint,
        share-percentage: uint,
        entry-apy: uint,
        deposited-at: uint,
        last-optimization: uint,
        rewards-earned: uint
    }
)

;; Rebalancing history
(define-map rebalance-history
    { user: principal, rebalance-id: uint }
    {
        from-pool: uint,
        to-pool: uint,
        amount: uint,
        from-apy: uint,
        to-apy: uint,
        apy-improvement: uint,
        gas-cost: uint,
        executed-at: uint,
        profit-realized: uint
    }
)

;; Optimization recommendations
(define-map optimization-recommendations
    principal
    {
        recommended-pools: (list 10 uint),
        expected-apy-improvement: uint,
        estimated-gas-cost: uint,
        confidence-score: uint,
        generated-at: uint,
        expires-at: uint,
        executed: bool
    }
)

;; Strategy performance metrics
(define-map strategy-performance
    { user: principal, period: uint }
    {
        start-value: uint,
        end-value: uint,
        total-yield: uint,
        apy-realized: uint,
        rebalances-count: uint,
        fees-paid: uint,
        net-profit: uint,
        period-start: uint,
        period-end: uint
    }
)

;; Automated rebalancing rules
(define-map rebalancing-rules
    { user: principal, rule-id: uint }
    {
        trigger-type: (string-ascii 32),
        threshold-value: uint,
        target-pools: (list 5 uint),
        target-allocations: (list 5 uint),
        max-gas-cost: uint,
        active: bool,
        created-at: uint,
        last-triggered: uint
    }
)

(define-data-var rule-counter uint u0)

;; Pool comparison matrix
(define-map pool-comparison
    { pool-a: uint, pool-b: uint }
    {
        apy-diff: uint,
        risk-diff: uint,
        liquidity-diff: uint,
        recommendation: (string-ascii 16),
        last-updated: uint
    }
)

;; ========================================
;; Read-Only Functions
;; ========================================

;; Get user strategy
(define-read-only (get-user-strategy (user principal))
    (map-get? user-strategies user)
)

;; Get pool yield data
(define-read-only (get-pool-yield (pool-id uint))
    (map-get? pool-yields pool-id)
)

;; Get user allocation
(define-read-only (get-user-allocation (user principal) (pool-id uint))
    (map-get? user-allocations { user: user, pool-id: pool-id })
)

;; Get rebalance history entry
(define-read-only (get-rebalance-history (user principal) (rebalance-id uint))
    (map-get? rebalance-history { user: user, rebalance-id: rebalance-id })
)

;; Get optimization recommendation
(define-read-only (get-optimization-recommendation (user principal))
    (map-get? optimization-recommendations user)
)

;; Get strategy performance
(define-read-only (get-strategy-performance (user principal) (period uint))
    (map-get? strategy-performance { user: user, period: period })
)

;; Calculate optimal allocation
(define-read-only (calculate-optimal-allocation (user principal) (total-amount uint))
    (let
        (
            (strategy (unwrap! (get-user-strategy user) (err u0)))
            (strategy-type (get strategy-type strategy))
        )
        ;; Simplified calculation - in production would analyze all pools
        (ok {
            suggested-pools: (list u1 u2 u3),
            allocations: (list (/ (* total-amount u50) u100) (/ (* total-amount u30) u100) (/ (* total-amount u20) u100)),
            expected-apy: u850,
            risk-score: u40
        })
    )
)

;; Check if rebalancing needed
(define-read-only (needs-rebalancing (user principal))
    (let
        (
            (strategy (unwrap! (get-user-strategy user) false))
            (last-rebalance (get last-rebalance strategy))
            (current-time stacks-block-time)
        )
        (and
            (get auto-rebalance strategy)
            (>= (- current-time last-rebalance) REBALANCE_COOLDOWN))
    )
)

;; Compare two pools
(define-read-only (compare-pools (pool-a uint) (pool-b uint))
    (let
        (
            (yield-a (unwrap! (get-pool-yield pool-a) (err u0)))
            (yield-b (unwrap! (get-pool-yield pool-b) (err u0)))
            (apy-diff (if (> (get current-apy yield-a) (get current-apy yield-b))
                (- (get current-apy yield-a) (get current-apy yield-b))
                (- (get current-apy yield-b) (get current-apy yield-a))))
        )
        (ok {
            better-pool: (if (> (get current-apy yield-a) (get current-apy yield-b)) pool-a pool-b),
            apy-difference: apy-diff,
            should-rebalance: (>= apy-diff MIN_REBALANCE_THRESHOLD)
        })
    )
)

;; ========================================
;; Public Functions - Strategy Management
;; ========================================

;; Set user optimization strategy
(define-public (set-optimization-strategy
    (strategy-type uint)
    (auto-rebalance bool)
    (rebalance-threshold uint))
    (let
        (
            (user tx-sender)
            (current-time stacks-block-time)
        )
        ;; Validate strategy type
        (asserts! (and (>= strategy-type STRATEGY_MAX_YIELD)
                      (<= strategy-type STRATEGY_AGGRESSIVE)) ERR_INVALID_STRATEGY)

        ;; Validate threshold
        (asserts! (>= rebalance-threshold MIN_REBALANCE_THRESHOLD) ERR_INVALID_THRESHOLD)

        (map-set user-strategies user {
            strategy-type: strategy-type,
            auto-rebalance: auto-rebalance,
            rebalance-threshold: rebalance-threshold,
            last-rebalance: current-time,
            total-rebalances: u0,
            total-value-moved: u0,
            active: true,
            created-at: current-time
        })

        (print {
            event: "strategy-set",
            user: user,
            strategy-type: strategy-type,
            auto-rebalance: auto-rebalance,
            rebalance-threshold: rebalance-threshold,
            timestamp: current-time
        })

        (ok true)
    )
)

;; Update pool yield data
(define-public (update-pool-yield
    (pool-id uint)
    (current-apy uint)
    (total-deposits uint)
    (total-rewards uint)
    (risk-score uint))
    (let
        (
            (existing-yield (get-pool-yield pool-id))
            (current-time stacks-block-time)
        )
        ;; In production, verify caller is authorized
        (asserts! (<= risk-score u100) ERR_INVALID_STRATEGY)

        (match existing-yield
            yield-data (let
                (
                    (new-avg-apy (/ (+ (get average-apy yield-data) current-apy) u2))
                )
                (map-set pool-yields pool-id {
                    pool-id: pool-id,
                    current-apy: current-apy,
                    average-apy: new-avg-apy,
                    total-deposits: total-deposits,
                    total-rewards: total-rewards,
                    risk-score: risk-score,
                    last-updated: current-time,
                    active: true
                })
            )
            (map-set pool-yields pool-id {
                pool-id: pool-id,
                current-apy: current-apy,
                average-apy: current-apy,
                total-deposits: total-deposits,
                total-rewards: total-rewards,
                risk-score: risk-score,
                last-updated: current-time,
                active: true
            })
        )

        (print {
            event: "pool-yield-updated",
            pool-id: pool-id,
            current-apy: current-apy,
            risk-score: risk-score,
            timestamp: current-time
        })

        (ok true)
    )
)

;; Execute rebalancing
(define-public (execute-rebalancing (from-pool uint) (to-pool uint) (amount uint))
    (let
        (
            (user tx-sender)
            (strategy (unwrap! (get-user-strategy user) ERR_STRATEGY_NOT_FOUND))
            (from-yield (unwrap! (get-pool-yield from-pool) ERR_STRATEGY_NOT_FOUND))
            (to-yield (unwrap! (get-pool-yield to-pool) ERR_STRATEGY_NOT_FOUND))
            (from-allocation (unwrap! (get-user-allocation user from-pool) ERR_INSUFFICIENT_BALANCE))
            (rebalance-id (+ (var-get rebalance-counter) u1))
            (current-time stacks-block-time)
            (apy-improvement (if (> (get current-apy to-yield) (get current-apy from-yield))
                (- (get current-apy to-yield) (get current-apy from-yield))
                u0))
            (fee (/ (* amount (var-get optimization-fee-bps)) u10000))
        )
        ;; Validate cooldown
        (asserts! (>= (- current-time (get last-rebalance strategy)) REBALANCE_COOLDOWN) ERR_COOLDOWN_ACTIVE)

        ;; Validate sufficient balance
        (asserts! (>= (get amount from-allocation) amount) ERR_INSUFFICIENT_BALANCE)

        ;; Validate APY improvement meets threshold
        (asserts! (>= apy-improvement (get rebalance-threshold strategy)) ERR_ALREADY_OPTIMIZED)

        ;; Update from-pool allocation
        (map-set user-allocations
            { user: user, pool-id: from-pool }
            (merge from-allocation {
                amount: (- (get amount from-allocation) amount),
                last-optimization: current-time
            })
        )

        ;; Update to-pool allocation
        (match (get-user-allocation user to-pool)
            to-allocation (map-set user-allocations
                { user: user, pool-id: to-pool }
                (merge to-allocation {
                    amount: (+ (get amount to-allocation) (- amount fee)),
                    last-optimization: current-time
                }))
            (map-set user-allocations
                { user: user, pool-id: to-pool }
                {
                    amount: (- amount fee),
                    share-percentage: u0,
                    entry-apy: (get current-apy to-yield),
                    deposited-at: current-time,
                    last-optimization: current-time,
                    rewards-earned: u0
                })
        )

        ;; Update strategy
        (map-set user-strategies user
            (merge strategy {
                last-rebalance: current-time,
                total-rebalances: (+ (get total-rebalances strategy) u1),
                total-value-moved: (+ (get total-value-moved strategy) amount)
            })
        )

        ;; Record rebalancing history
        (map-set rebalance-history
            { user: user, rebalance-id: rebalance-id }
            {
                from-pool: from-pool,
                to-pool: to-pool,
                amount: amount,
                from-apy: (get current-apy from-yield),
                to-apy: (get current-apy to-yield),
                apy-improvement: apy-improvement,
                gas-cost: fee,
                executed-at: current-time,
                profit-realized: u0
            }
        )

        (var-set rebalance-counter rebalance-id)
        (var-set total-value-optimized (+ (var-get total-value-optimized) amount))
        (var-set total-fees-collected (+ (var-get total-fees-collected) fee))

        (print {
            event: "rebalancing-executed",
            user: user,
            rebalance-id: rebalance-id,
            from-pool: from-pool,
            to-pool: to-pool,
            amount: amount,
            apy-improvement: apy-improvement,
            fee: fee,
            timestamp: current-time
        })

        (ok rebalance-id)
    )
)

;; Generate optimization recommendation
(define-public (generate-recommendation (user principal))
    (let
        (
            (strategy (unwrap! (get-user-strategy user) ERR_STRATEGY_NOT_FOUND))
            (current-time stacks-block-time)
        )
        ;; Simplified recommendation - in production would analyze all pools
        (map-set optimization-recommendations user {
            recommended-pools: (list u1 u2 u3),
            expected-apy-improvement: u150,
            estimated-gas-cost: u5000,
            confidence-score: u85,
            generated-at: current-time,
            expires-at: (+ current-time u1440),
            executed: false
        })

        (print {
            event: "recommendation-generated",
            user: user,
            expected-improvement: u150,
            confidence: u85,
            timestamp: current-time
        })

        (ok true)
    )
)

;; Create automated rebalancing rule
(define-public (create-rebalancing-rule
    (trigger-type (string-ascii 32))
    (threshold-value uint)
    (target-pools (list 5 uint))
    (target-allocations (list 5 uint))
    (max-gas-cost uint))
    (let
        (
            (user tx-sender)
            (rule-id (+ (var-get rule-counter) u1))
            (current-time stacks-block-time)
        )
        (asserts! (is-eq (len target-pools) (len target-allocations)) ERR_INVALID_STRATEGY)

        (map-set rebalancing-rules
            { user: user, rule-id: rule-id }
            {
                trigger-type: trigger-type,
                threshold-value: threshold-value,
                target-pools: target-pools,
                target-allocations: target-allocations,
                max-gas-cost: max-gas-cost,
                active: true,
                created-at: current-time,
                last-triggered: u0
            }
        )

        (var-set rule-counter rule-id)

        (print {
            event: "rebalancing-rule-created",
            user: user,
            rule-id: rule-id,
            trigger-type: trigger-type,
            timestamp: current-time
        })

        (ok rule-id)
    )
)

;; Record strategy performance
(define-public (record-performance
    (user principal)
    (period uint)
    (start-value uint)
    (end-value uint)
    (fees-paid uint))
    (let
        (
            (total-yield (if (> end-value start-value) (- end-value start-value) u0))
            (net-profit (if (> total-yield fees-paid) (- total-yield fees-paid) u0))
            (apy-realized (if (> start-value u0)
                (/ (* total-yield u10000) start-value)
                u0))
        )
        ;; In production, verify caller is authorized

        (map-set strategy-performance
            { user: user, period: period }
            {
                start-value: start-value,
                end-value: end-value,
                total-yield: total-yield,
                apy-realized: apy-realized,
                rebalances-count: u0,
                fees-paid: fees-paid,
                net-profit: net-profit,
                period-start: stacks-block-time,
                period-end: stacks-block-time
            }
        )

        (print {
            event: "performance-recorded",
            user: user,
            period: period,
            apy-realized: apy-realized,
            net-profit: net-profit,
            timestamp: stacks-block-time
        })

        (ok true)
    )
)

;; ========================================
;; Admin Functions
;; ========================================

;; Update optimization fee
(define-public (set-optimization-fee (new-fee-bps uint))
    (begin
        (asserts! (is-eq tx-sender CONTRACT_OWNER) ERR_NOT_AUTHORIZED)
        (asserts! (<= new-fee-bps u100) ERR_INVALID_THRESHOLD)

        (var-set optimization-fee-bps new-fee-bps)

        (print {
            event: "optimization-fee-updated",
            new-fee-bps: new-fee-bps,
            timestamp: stacks-block-time
        })

        (ok true)
    )
)
