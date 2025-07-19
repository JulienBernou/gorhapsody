from .goboard import GoBoard
import math
import itertools

class GameAnalyzer:
    def __init__(self, sgf_data, board_size=19):
        """
        Initializes the analyzer with game data and board size.
        """
        self.sgf_data = sgf_data
        self.board_size = board_size
        self.board = GoBoard(size=self.board_size)
        self.moves_analysis = []

    def analyze(self):
        previous_friendly_stones = {'B': None, 'W': None}
        player_map = {'B': 1, 'W': 2} # Map player strings to integers

        for i, move in enumerate(self.sgf_data):
            player_str, x, y = move['player'], move['x'], move['y']
            
            # --- FIX: Convert player string to integer ---
            player = player_map[player_str]

            report = {
                'move_number': i + 1,
                'player': player_str, # Keep original string for report
                'sgf_coords': move.get('sgf_coords', 'pass'),
                'coords': (x,y)
            }
            
            if x is None or y is None:
                report['type'] = 'Pass'
                self.moves_analysis.append(report)
                continue

            # --- Analysis ---
            board_before_move = [row[:] for row in self.board.get_board_state()]

            # Play the move (now with an integer player)
            captured_stones = self.board.play_move(x, y, player)
            report['captured_count'] = len(captured_stones)
            report['captures'] = captured_stones
            
            current_group, liberties, _ = self.board.get_group(x,y)
            report['liberties'] = len(liberties)

            report['atari'] = self.is_atari(x, y, player)
            report['atari_threats'] = self.detect_atari_threat(x, y, player)
            report['ko_detected'] = self.detect_ko(x, y, player)
            report['is_contact'] = self.is_contact_move(x, y, player, board_before_move)
            report['is_cut'] = self.is_cut_move(x, y, player, board_before_move)

            # --- Metrics ---
            center_coord = (self.board_size - 1) / 2
            report['distance_from_center'] = self.distance_from_center(x, y, center=center_coord)
            
            prev_stone = previous_friendly_stones[player_str]
            if prev_stone:
                report['distance_from_previous_friendly_stone'] = self.distance_between_points(x, y, prev_stone[0], prev_stone[1])
            else:
                report['distance_from_previous_friendly_stone'] = None
            previous_friendly_stones[player_str] = (x, y)

            dist_friendly, dist_enemy = self.distance_to_nearest_stones(x, y, player)
            report['distance_to_nearest_friendly_stone'] = dist_friendly
            report['distance_to_nearest_enemy_stone'] = dist_enemy

            # --- Pattern Matching ---
            move_type, details = self.classify_move(x, y, i, report, player)
            report['type'] = move_type
            if 'large_enclosure_type' in details:
                report['large_enclosure_type'] = details['large_enclosure_type']

            self.moves_analysis.append(report)
            
        return self.moves_analysis

    def is_atari(self, x, y, player):
        opponent = 3 - player
        atari_groups = []
        for nx, ny in self.board.get_neighbors(x,y):
            if self.board.board[ny][nx] == opponent:
                _, liberties, _ = self.board.get_group(nx, ny)
                if len(liberties) == 1:
                    atari_groups.append(((nx,ny)))
        return atari_groups
        
    def is_contact_move(self, x, y, player, board_state):
        opponent = 3 - player
        for nx, ny in self.board.get_neighbors(x, y):
            if board_state[ny][nx] == opponent:
                return True
        return False

    def is_cut_move(self, x, y, player, board_before_move):
        opponent = 3 - player
        
        neighboring_enemy_groups = set()
        for nx, ny in self.board.get_neighbors(x, y):
            if board_before_move[ny][nx] == opponent:
                temp_board = GoBoard(self.board_size)
                temp_board.board = board_before_move
                stones, _, _ = temp_board.get_group(nx, ny)
                neighboring_enemy_groups.add(frozenset(stones))
        
        if len(neighboring_enemy_groups) < 2:
            return False

        for group1_stones, group2_stones in itertools.combinations(neighboring_enemy_groups, 2):
            temp_board = GoBoard(self.board_size)
            temp_board.board = board_before_move
            
            liberties1_before = temp_board.get_liberties_for_stones(list(group1_stones))
            liberties2_before = temp_board.get_liberties_for_stones(list(group2_stones))
            common_liberties_before = liberties1_before.intersection(liberties2_before)

            if common_liberties_before == {(x, y)}:
                return True
                    
        return False

    def detect_atari_threat(self, x, y, player):
        group, liberties, _ = self.board.get_group(x, y)
        if len(liberties) != 2:
            return []

        threats = []
        for lx, ly in liberties:
            self.board.board[ly][lx] = 3 - player
            _, new_liberties, _ = self.board.get_group(x, y)
            self.board.board[ly][lx] = 0
            if len(new_liberties) == 1:
                threats.append((lx,ly))
        
        return threats
        
    def detect_ko(self, x, y, player):
        # This is a simplified placeholder
        return False

    def classify_move(self, x, y, move_index, report, player):
        details = {}

        if report.get('captured_count', 0) > 0:
            return 'Capture', details
        
        if report.get('atari'):
            return 'Atari', details
        
        if report.get('atari_threats'):
            return 'Atari Threat', details
        
        if report.get('is_contact'):
            return 'Contact Move', details

        if self.board_size == 19 and move_index < 20:
            if (x, y) in [(3,3), (3,15), (15,3), (15,15)]: return 'Star Point', details
            if (x, y) in [(2,2), (2,16), (16,2), (16,16)]: return '3-3 Point', details
            if (x, y) in [(2,3), (3,2), (2,15), (15,2), (3,16), (16,3), (15,16), (16,15)]: return '3-4 Point', details
            if move_index == 0: return 'First Corner Play', details

        enclosure_type = self.is_corner_enclosure(x, y, player)
        if enclosure_type:
            details['enclosure_type'] = enclosure_type
            return 'Corner Enclosure', details
            
        large_enclosure_type = self.is_large_enclosure(x, y, player)
        if large_enclosure_type:
            details['large_enclosure_type'] = large_enclosure_type
            return large_enclosure_type, details

        return 'Normal Move', details

    def is_corner_enclosure(self, x, y, player):
        if self.board_size != 19: return None
        corner_stones = [
            (2,3), (3,2), (2,4), (4,2), (3,4), (4,3),
            (2,15), (3,16), (2,14), (4,16), (3,14), (4,15),
            (16,3), (15,2), (16,4), (14,2), (15,4), (14,3),
            (16,15), (15,16), (16,14), (14,16), (15,14), (14,15)
        ]
        if (x,y) not in corner_stones: return None
        
        dist, _ = self.distance_to_nearest_stones(x, y, player)
        if dist and dist < 2.5:
            return "Small Knight"
        return None

    def is_large_enclosure(self, x, y, player):
        dist, _ = self.distance_to_nearest_stones(x, y, player)
        if dist and dist == 3.0:
            return "Large Enclosure"
        return None

    def distance_from_center(self, x, y, center):
        return math.sqrt((x - center)**2 + (y - center)**2)

    def distance_between_points(self, x1, y1, x2, y2):
        return math.sqrt((x1 - x2)**2 + (y1 - y2)**2)

    def distance_to_nearest_stones(self, x, y, player):
        min_dist_friendly = float('inf')
        min_dist_enemy = float('inf')
        opponent = 3 - player

        for r in range(self.board.size):
            for c in range(self.board.size):
                if (c, r) == (x, y): continue
                
                stone = self.board.board[r][c]
                if stone != 0:
                    dist = self.distance_between_points(x, y, c, r)
                    if stone == player:
                        if dist < min_dist_friendly:
                            min_dist_friendly = dist
                    elif stone == opponent:
                        if dist < min_dist_enemy:
                            min_dist_enemy = dist

        return min_dist_friendly if min_dist_friendly != float('inf') else None, \
               min_dist_enemy if min_dist_enemy != float('inf') else None